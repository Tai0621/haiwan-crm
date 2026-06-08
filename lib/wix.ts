// =============================================================================
// Wix inventory sync — Wix is the source of truth for on-hand stock.
//
// Wix Stores (Catalog V1) exposes a product's total quantity but, for this
// account, NO SKUs — so products are matched to the CRM catalog by name. To
// avoid mis-assigning stock, matching is STRICT: an exact normalised-name hit
// only (no fuzzy containment). Once matched, the Wix product id is stored on
// the CRM Product so subsequent syncs are an exact, O(1) re-link.
//
// What it writes: Product.wixStock (authoritative on-hand), Product.wixProductId
// (the link), Product.wixSyncedAt. The legacy stockKL/stockPJ are left as-is.
//
// Config (env): WIX_API_KEY, WIX_SITE_ID.
// =============================================================================

import { prisma } from "./db";
import { normalizeProductName } from "./match";

const WIX_API = "https://www.wixapis.com";

export interface WixSyncSummary {
  ok: boolean;
  error?: string;
  wixProductCount: number;
  matched: number; // Wix products linked to a CRM product
  updated: number; // CRM products whose Wix stock was written
  unmatched: string[]; // Wix product names with no exact CRM match
  ambiguous: string[]; // matched a CRM product already claimed this run
  syncedAt: string;
}

interface WixProduct {
  id: string;
  name: string;
  quantity: number | null;
}

function wixConfig(): { key: string; site: string } | null {
  const key = process.env.WIX_API_KEY;
  const site = process.env.WIX_SITE_ID;
  return key && site ? { key, site } : null;
}

async function fetchAllWixProducts(key: string, site: string): Promise<WixProduct[]> {
  const headers = {
    Authorization: key,
    "wix-site-id": site,
    "Content-Type": "application/json",
  };
  const out: WixProduct[] = [];
  let offset = 0;
  // Hard page cap as a safety valve against an unexpected paging loop.
  for (let page = 0; page < 200; page++) {
    const res = await fetch(`${WIX_API}/stores-reader/v1/products/query`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: { paging: { limit: 100, offset } }, includeVariants: false }),
    });
    if (!res.ok) {
      throw new Error(`Wix products query failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    }
    const j = (await res.json()) as {
      products?: Array<{ id: string; name: string; stock?: { quantity?: number | null } }>;
    };
    const batch = j.products ?? [];
    for (const p of batch) {
      out.push({ id: p.id, name: p.name, quantity: p.stock?.quantity ?? null });
    }
    if (batch.length < 100) break;
    offset += 100;
  }
  return out;
}

export async function syncWixInventory(): Promise<WixSyncSummary> {
  const syncedAt = new Date().toISOString();
  const base: WixSyncSummary = {
    ok: true,
    wixProductCount: 0,
    matched: 0,
    updated: 0,
    unmatched: [],
    ambiguous: [],
    syncedAt,
  };

  const cfg = wixConfig();
  if (!cfg) {
    return { ...base, ok: false, error: "WIX_API_KEY / WIX_SITE_ID are not set." };
  }

  let wixProducts: WixProduct[];
  try {
    wixProducts = await fetchAllWixProducts(cfg.key, cfg.site);
  } catch (e) {
    return { ...base, ok: false, error: (e as Error).message };
  }
  base.wixProductCount = wixProducts.length;

  const crm = await prisma.product.findMany({
    select: { id: true, name: true, wixProductId: true },
  });

  // Exact normalised-name index (last wins on the rare CRM-side duplicate).
  const byName = new Map<string, string>();
  for (const p of crm) byName.set(normalizeProductName(p.name), p.id);
  // Prior-sync links: Wix id -> CRM id (fast, exact re-link).
  const byWixId = new Map<string, string>();
  for (const p of crm) if (p.wixProductId) byWixId.set(p.wixProductId, p.id);

  const claimed = new Set<string>();
  const updates: { crmId: string; wixId: string; stock: number | null }[] = [];

  for (const w of wixProducts) {
    const crmId = byWixId.get(w.id) ?? byName.get(normalizeProductName(w.name)) ?? null;
    if (!crmId) {
      base.unmatched.push(w.name);
      continue;
    }
    if (claimed.has(crmId)) {
      base.ambiguous.push(w.name);
      continue;
    }
    claimed.add(crmId);
    base.matched++;
    updates.push({ crmId, wixId: w.id, stock: w.quantity });
  }

  // Apply updates in small concurrent batches (each row is independent, so no
  // transaction is needed). Concurrency keeps wall-time low against a remote
  // (Turso) DB without tripping Prisma's interactive-transaction timeout.
  const now = new Date();
  const CONCURRENCY = 15;
  for (let i = 0; i < updates.length; i += CONCURRENCY) {
    const chunk = updates.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map((u) =>
        prisma.product.update({
          where: { id: u.crmId },
          data: { wixProductId: u.wixId, wixStock: u.stock, wixSyncedAt: now },
        }),
      ),
    );
    base.updated += chunk.length;
  }

  return base;
}
