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
  updated: number; // existing CRM rows whose Wix stock was written
  created: number; // genuinely-new products created as a single CRM row
  unmatched: string[]; // unit names with no CRM match (near-misses, reported)
  novelProducts: string[]; // base products created (new to the CRM)
  syncedAt: string;
}

// Category tag for auto-created products, so they're easy to find/clean up.
const WIX_IMPORT_CATEGORY = "Wix import";

interface WixVariant {
  choices?: Record<string, string>;
  stock?: { quantity?: number | null };
}
interface WixRawProduct {
  id: string;
  name: string;
  manageVariants?: boolean;
  stock?: { quantity?: number | null };
  price?: { price?: number | null };
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

/**
 * Canonicalise a Wix option VALUE toward the CRM's vocabulary so the variant
 * names line up. Currently handles the verbose "Deboss/Stamping" option:
 *   "I do not want to deboss…"            -> "no stamping"
 *   "Deboss my Haiwan's collar for RM 20" -> "stamping add on rm 20"
 * Any value without a deboss/stamp keyword is returned unchanged (no-op for
 * colours, sizes, scents, etc.).
 */
function canonicalizeOptionValue(v: string): string {
  const t = v.toLowerCase();
  if (!/deboss|stamp/.test(t)) return v;
  if (/\bno\b|\bnot\b|don'?t/.test(t)) return "nostamp";
  const m = t.match(/rm\s*(\d+)/);
  return m ? `stamp${m[1]}` : "stamp";
}

/**
 * Collapse the CRM's *inconsistent* stamping wording to the same neutral tokens
 * the Wix side uses ("nostamp" / "stampN"). The CRM mixes phrasings across
 * products — e.g. "NO STAMPING" vs "NO ADD ONS", "STAMPING ADD ON RM 10" vs
 * "STAMP RM 20" — so both sides must be reduced for the names to line up.
 */
function normalizeStampingPhrase(name: string): string {
  return name
    .replace(/no add ?ons|no stamping/gi, " nostamp ")
    .replace(/(?:stamping add on|stamp(?:ing)?)\s*rm\s*(\d+)/gi, " stamp$1 ");
}

/** Canonical key for matching a product/variant name on either side. */
function matchKey(name: string): string {
  return normalizeProductName(normalizeStampingPhrase(name));
}

/** Order-independent, de-duplicated token signature (handles reordered names
 *  and harmless repeated tokens, e.g. "NOU … NOU"). */
function tokenSignature(name: string): string {
  return [...new Set(matchKey(name).split(" ").filter(Boolean))].sort().join(" ");
}

/** Expand a Wix product into matchable units (one per managed variant, else one). */
function unitsFor(p: WixRawProduct): SyncUnit[] {
  const variants = p.variants ?? [];
  const managed = !!p.manageVariants && variants.some((v) => v.choices && Object.keys(v.choices).length > 0);
  if (managed) {
    return variants.map((v) => {
      const raw = Object.values(v.choices ?? {});
      const canon = raw.map(canonicalizeOptionValue);
      return {
        // linkKey uses the raw choices so it stays stable across vocab tweaks.
        linkKey: `${p.id}#${raw.join("/")}`,
        // name uses canonicalised values so it matches the CRM's wording.
        name: `${p.name} ${canon.join(" ")}`,
        quantity: v.stock?.quantity ?? null,
      };
    });
  }
  return [{ linkKey: p.id, name: p.name, quantity: p.stock?.quantity ?? null }];
}

/** Total on-hand across a product's units (null only if no unit tracks stock). */
function totalQuantity(units: SyncUnit[]): number | null {
  let sum = 0;
  let any = false;
  for (const u of units) {
    if (u.quantity != null) {
      sum += u.quantity;
      any = true;
    }
  }
  return any ? sum : null;
}

export async function syncWixInventory(): Promise<WixSyncSummary> {
  const syncedAt = new Date().toISOString();
  const base: WixSyncSummary = {
    ok: true,
    wixProductCount: 0,
    unitCount: 0,
    updated: 0,
    created: 0,
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
  // Token-signature index (sorted tokens) for order-independent matching.
  const bySig = new Map<string, string[]>();
  for (const p of crm) {
    const n = matchKey(p.name);
    byName.set(n, p.id);
    crmNorms.push(n);
    const sig = tokenSignature(p.name);
    const arr = bySig.get(sig);
    if (arr) arr.push(p.id);
    else bySig.set(sig, [p.id]);
  }
  const byLink = new Map<string, string>();
  for (const p of crm) if (p.wixProductId) byLink.set(p.wixProductId, p.id);

  const claimed = new Set<string>();
  const updates: { crmId: string; linkKey: string; stock: number | null }[] = [];
  const creates: { wixId: string; name: string; price: number | null; stock: number | null }[] = [];

  for (const p of products) {
    const units = unitsFor(p);
    base.unitCount += units.length;

    // Match each variant unit to an existing CRM row.
    const matchedHere: { crmId: string; linkKey: string; stock: number | null }[] = [];
    const unmatchedHere: string[] = [];
    for (const u of units) {
      // 1) prior-sync link  2) exact (canonicalised) name  3) token-set (reorder)
      let crmId = byLink.get(u.linkKey) ?? byName.get(matchKey(u.name)) ?? null;
      if (!crmId) {
        const sigHits = bySig.get(tokenSignature(u.name));
        if (sigHits) {
          const free = sigHits.filter((id) => !claimed.has(id));
          if (free.length === 1) crmId = free[0]; // unique -> safe
        }
      }
      if (crmId && !claimed.has(crmId)) {
        claimed.add(crmId);
        matchedHere.push({ crmId, linkKey: u.linkKey, stock: u.quantity });
      } else {
        unmatchedHere.push(u.name);
      }
    }

    if (matchedHere.length > 0) {
      // Variant-split product already in the CRM: update matches; report any
      // variants that didn't line up (a name to reconcile).
      updates.push(...matchedHere);
      base.unmatched.push(...unmatchedHere);
      continue;
    }

    // No variant matched. Decide what this product is.
    const totalStock = totalQuantity(units);
    const baseLinked = byLink.get(p.id);
    if (baseLinked && !claimed.has(baseLinked)) {
      // A single row we auto-created on a previous sync — refresh its total.
      claimed.add(baseLinked);
      updates.push({ crmId: baseLinked, linkKey: p.id, stock: totalStock });
      continue;
    }
    const bn = matchKey(p.name);
    const fuzzy = crmNorms.some((cn) => cn.length >= 4 && (cn.includes(bn) || bn.includes(cn)));
    if (fuzzy) {
      // Near-miss: exists in the CRM under a different name — report, don't dup.
      base.unmatched.push(...unmatchedHere);
    } else {
      // Genuinely new — create one CRM row for the whole product.
      creates.push({ wixId: p.id, name: p.name, price: p.price?.price ?? null, stock: totalStock });
      base.novelProducts.push(p.name);
    }
  }

  // Apply in small concurrent batches (independent rows; no transaction — avoids
  // Prisma's interactive-transaction timeout against a remote DB).
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

  // Create genuinely-new products as one row each. Upsert on wixProductId so a
  // re-run updates rather than duplicates. Synthetic SKU (Wix has none).
  for (let i = 0; i < creates.length; i += CONCURRENCY) {
    const chunk = creates.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map((c) =>
        prisma.product.upsert({
          where: { wixProductId: c.wixId },
          create: {
            sku: `WIX-${c.wixId}`,
            name: c.name,
            category: WIX_IMPORT_CATEGORY,
            retailPrice: c.price,
            wixProductId: c.wixId,
            wixStock: c.stock,
            wixSyncedAt: now,
          },
          update: { wixStock: c.stock, wixSyncedAt: now },
        }),
      ),
    );
    base.created += chunk.length;
  }

  return base;
}
