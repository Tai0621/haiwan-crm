// =============================================================================
// Wix inventory sync — Wix is the source of truth for on-hand stock.
//
// Wix Stores (Catalog V1) exposes per-PRODUCT and per-VARIANT quantities but,
// for this account, NO SKUs — so products are matched to the CRM catalog by
// NAME. Wix keeps one product with variants inside (e.g. "Paw Cleanser 100ml"
// with a Scent option); the CRM (from StoreHub) stores each variant as its own
// row ("…100ML(LAVENDER)"). So we expand each Wix product into one "unit" per
// variant — name = base + the variant's option values — and match each unit to
// the CRM row by exact normalised name. Matching strict-exact (no fuzzy) to
// avoid mis-assigning stock; the per-variant link key is stored on the CRM row
// (Product.wixProductId) so later syncs are an exact, O(1) re-link.
//
// What it writes: Product.wixStock (authoritative on-hand), Product.wixProductId
// (the variant link key), Product.wixSyncedAt. Legacy stockKL/stockPJ untouched.
// Unmatched units are reported, never auto-created (avoids duplicates).
//
// Config (env): WIX_API_KEY, WIX_SITE_ID.
// =============================================================================

import { prisma } from "./db";
import { normalizeProductName } from "./match";

const WIX_API = "https://www.wixapis.com";

export interface WixSyncSummary {
  ok: boolean;
  error?: string;
  wixProductCount: number; // base Wix products
  unitCount: number; // variant-level units (what we actually match)
  updated: number; // CRM rows whose Wix stock was written
  unmatched: string[]; // unit names with no CRM match (reported)
  novelProducts: string[]; // base products with NO CRM presence at all (new to us)
  syncedAt: string;
}

interface WixVariant {
  choices?: Record<string, string>;
  stock?: { quantity?: number | null };
}
interface WixRawProduct {
  id: string;
  name: string;
  manageVariants?: boolean;
  stock?: { quantity?: number | null };
  variants?: WixVariant[];
}

/** A single matchable unit: a standalone product or one variant of a product. */
interface SyncUnit {
  linkKey: string; // stored on the CRM row as wixProductId for fast re-link
  name: string; // base name + variant option values
  quantity: number | null;
}

function wixConfig(): { key: string; site: string } | null {
  const key = process.env.WIX_API_KEY;
  const site = process.env.WIX_SITE_ID;
  return key && site ? { key, site } : null;
}

async function fetchAllWixProducts(key: string, site: string): Promise<WixRawProduct[]> {
  const headers = { Authorization: key, "wix-site-id": site, "Content-Type": "application/json" };
  const out: WixRawProduct[] = [];
  let offset = 0;
  for (let page = 0; page < 200; page++) {
    const res = await fetch(`${WIX_API}/stores-reader/v1/products/query`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: { paging: { limit: 100, offset } }, includeVariants: true }),
    });
    if (!res.ok) {
      throw new Error(`Wix products query failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    }
    const j = (await res.json()) as { products?: WixRawProduct[] };
    const batch = j.products ?? [];
    out.push(...batch);
    if (batch.length < 100) break;
    offset += 100;
  }
  return out;
}

/** Expand a Wix product into matchable units (one per managed variant, else one). */
function unitsFor(p: WixRawProduct): SyncUnit[] {
  const variants = p.variants ?? [];
  const managed = !!p.manageVariants && variants.some((v) => v.choices && Object.keys(v.choices).length > 0);
  if (managed) {
    return variants.map((v) => {
      const values = Object.values(v.choices ?? {});
      return {
        linkKey: `${p.id}#${values.join("/")}`,
        name: `${p.name} ${values.join(" ")}`,
        quantity: v.stock?.quantity ?? null,
      };
    });
  }
  return [{ linkKey: p.id, name: p.name, quantity: p.stock?.quantity ?? null }];
}

export async function syncWixInventory(): Promise<WixSyncSummary> {
  const syncedAt = new Date().toISOString();
  const base: WixSyncSummary = {
    ok: true,
    wixProductCount: 0,
    unitCount: 0,
    updated: 0,
    unmatched: [],
    novelProducts: [],
    syncedAt,
  };

  const cfg = wixConfig();
  if (!cfg) return { ...base, ok: false, error: "WIX_API_KEY / WIX_SITE_ID are not set." };

  let products: WixRawProduct[];
  try {
    products = await fetchAllWixProducts(cfg.key, cfg.site);
  } catch (e) {
    return { ...base, ok: false, error: (e as Error).message };
  }
  base.wixProductCount = products.length;

  const crm = await prisma.product.findMany({
    select: { id: true, name: true, wixProductId: true },
  });
  const byName = new Map<string, string>();
  const crmNorms: string[] = [];
  for (const p of crm) {
    const n = normalizeProductName(p.name);
    byName.set(n, p.id);
    crmNorms.push(n);
  }
  const byLink = new Map<string, string>();
  for (const p of crm) if (p.wixProductId) byLink.set(p.wixProductId, p.id);

  const claimed = new Set<string>();
  const updates: { crmId: string; linkKey: string; stock: number | null }[] = [];

  for (const p of products) {
    const units = unitsFor(p);
    base.unitCount += units.length;
    let anyMatched = false;
    const unmatchedHere: string[] = [];

    for (const u of units) {
      const crmId = byLink.get(u.linkKey) ?? byName.get(normalizeProductName(u.name)) ?? null;
      if (crmId && !claimed.has(crmId)) {
        claimed.add(crmId);
        updates.push({ crmId, linkKey: u.linkKey, stock: u.quantity });
        anyMatched = true;
      } else {
        unmatchedHere.push(u.name);
      }
    }

    if (unmatchedHere.length) {
      base.unmatched.push(...unmatchedHere);
      // A base product is "novel" only if NONE of its units matched and its
      // name has no fuzzy presence in the CRM — i.e. genuinely new to us.
      if (!anyMatched) {
        const bn = normalizeProductName(p.name);
        const fuzzy = crmNorms.some((cn) => cn.length >= 4 && (cn.includes(bn) || bn.includes(cn)));
        if (!fuzzy) base.novelProducts.push(p.name);
      }
    }
  }

  // Apply updates in small concurrent batches (independent rows; no transaction
  // — avoids Prisma's interactive-transaction timeout against a remote DB).
  const now = new Date();
  const CONCURRENCY = 15;
  for (let i = 0; i < updates.length; i += CONCURRENCY) {
    const chunk = updates.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map((u) =>
        prisma.product.update({
          where: { id: u.crmId },
          data: { wixProductId: u.linkKey, wixStock: u.stock, wixSyncedAt: now },
        }),
      ),
    );
    base.updated += chunk.length;
  }

  return base;
}
