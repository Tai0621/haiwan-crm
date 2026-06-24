// =============================================================================
// StoreHub sync — StoreHub is the source of truth for transactions (sales) and
// the membership/customer list. (Wix owns inventory; see lib/wix.ts.)
//
// API: https://api.storehubhq.com  ·  HTTP Basic auth.
//   GET /stores                      → outlets (id → KL/PJ mapping below)
//   GET /customers                   → all members (refId, name, phone, loyalty)
//   GET /products                    → catalogue (id → name), used to label lines
//   GET /transactions?from=&to=      → sales in an ISO time window
//
// Transactions carry `invoiceNumber` (the human receipt no.) and `refId` (a
// UUID). The CRM's historical CSV import stored the *receipt number* in
// Transaction.storehubRef, so we dedupe on `invoiceNumber` — that makes the
// sync incremental and safe to re-run (already-imported receipts are skipped).
//
// Most POS sales have no customer attached, but when one is, the transaction
// carries `customerRefId`; we resolve it → phone → CRM customer to link it.
//
// Config (env): STOREHUB_API_USERNAME, STOREHUB_API_PASSWORD.
// =============================================================================

import { prisma } from "./db";
import { normalizePhone } from "./phone";
import { buildProductIndex, matchProduct } from "./match";
import { findExistingCustomer, buildEnrichment } from "./customer-resolve";

const SH_BASE = "https://api.storehubhq.com";

// StoreHub store id → CRM Store enum. "Digital Store" (online) has no physical
// outlet, so it maps to NONE.
const STORE_BY_ID: Record<string, "KL" | "PJ" | "NONE"> = {
  "61a7399f833fc20006b27935": "KL", // Haiwan - The Concept KL
  "6809023723cb780007b06393": "PJ", // Haiwan - The Concept PJ
  "65df02fab1528f34253d6af4": "NONE", // Digital Store (online)
};

interface SHCustomer {
  refId: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  loyalty?: number;
}
interface SHProduct {
  id: string;
  name: string;
}
interface SHTransactionItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  total: number;
}
interface SHTransaction {
  refId: string;
  invoiceNumber: string;
  storeId: string;
  transactionType: string; // "Sale" | …
  transactionTime: string; // ISO
  total: number;
  isCancelled?: boolean;
  customerRefId?: string;
  items?: SHTransactionItem[];
}

function shConfig(): { user: string; pass: string } | null {
  const user = process.env.STOREHUB_API_USERNAME;
  const pass = process.env.STOREHUB_API_PASSWORD;
  return user && pass ? { user, pass } : null;
}

export function storeHubConfigured(): boolean {
  return shConfig() !== null;
}

async function shGet<T>(path: string, cfg: { user: string; pass: string }): Promise<T> {
  const auth = "Basic " + Buffer.from(`${cfg.user}:${cfg.pass}`).toString("base64");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000); // never hang a page render
  try {
    const res = await fetch(SH_BASE + path, {
      headers: { Authorization: auth, Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`StoreHub ${path} → ${res.status} ${res.statusText} ${body.slice(0, 160)}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

const fullName = (c: SHCustomer): string | null =>
  [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || null;

// ---------------------------------------------------------------------------
// Customer / membership sync. Upserts StoreHub members into the CRM keyed by
// phone (the CRM identity key). Only fills a blank name — never overwrites
// data staff may have edited.
// ---------------------------------------------------------------------------

export interface StoreHubCustomerSyncSummary {
  ok: boolean;
  error?: string;
  total: number; // members returned by StoreHub
  created: number; // new CRM customers
  updated: number; // existing CRM customers enriched (name filled)
  skippedNoPhone: number; // members with no usable phone
  syncedAt: string;
}

export async function syncStoreHubCustomers(): Promise<StoreHubCustomerSyncSummary> {
  const syncedAt = new Date().toISOString();
  const cfg = shConfig();
  if (!cfg)
    return { ok: false, error: "StoreHub not configured", total: 0, created: 0, updated: 0, skippedNoPhone: 0, syncedAt };

  try {
    const members = await shGet<SHCustomer[]>("/customers", cfg);
    let created = 0,
      updated = 0,
      skippedNoPhone = 0;

    for (const m of members) {
      const phone = m.phone ? normalizePhone(m.phone) : null;
      if (!phone) {
        skippedNoPhone++;
        continue;
      }
      const name = fullName(m);
      const existing = await findExistingCustomer({ phone });
      if (existing) {
        const data = buildEnrichment(existing, { name }, phone);
        // Mirror StoreHub loyalty points for reconciliation (not the source of
        // truth — the CRM's computed tier is). Always refreshed to the latest.
        const extra = m.loyalty != null ? { posLoyaltyPoints: m.loyalty } : {};
        if (Object.keys(data).length || Object.keys(extra).length) {
          await prisma.customer.update({ where: { id: existing.id }, data: { ...data, ...extra } });
          updated++;
        }
      } else {
        await prisma.customer.create({
          data: { phone, name, source: "STOREHUB", needsDetails: !name, posLoyaltyPoints: m.loyalty ?? null },
        });
        created++;
      }
    }

    return { ok: true, total: members.length, created, updated, skippedNoPhone, syncedAt };
  } catch (e) {
    return {
      ok: false,
      error: (e as Error).message,
      total: 0,
      created: 0,
      updated: 0,
      skippedNoPhone: 0,
      syncedAt,
    };
  }
}

// ---------------------------------------------------------------------------
// Transaction sync. Pulls sales in a recent window, dedupes on invoiceNumber,
// matches line items to CRM products by name, and links to a customer when the
// sale carries a member ref. Incremental: safe to run repeatedly.
// ---------------------------------------------------------------------------

export interface StoreHubTransactionSyncSummary {
  ok: boolean;
  error?: string;
  days: number; // window pulled
  fetched: number; // transactions returned by StoreHub
  created: number; // new CRM transactions
  skippedDuplicate: number; // already imported (by receipt no.)
  skippedCancelled: number; // cancelled / non-sale, ignored
  linkedToCustomer: number; // created txns linked to a member
  linesMatched: number;
  linesUnmatched: number;
  syncedAt: string;
}

export async function syncStoreHubTransactions(
  days = 7,
): Promise<StoreHubTransactionSyncSummary> {
  const syncedAt = new Date().toISOString();
  const base = {
    days,
    fetched: 0,
    created: 0,
    skippedDuplicate: 0,
    skippedCancelled: 0,
    linkedToCustomer: 0,
    linesMatched: 0,
    linesUnmatched: 0,
    syncedAt,
  };
  const cfg = shConfig();
  if (!cfg) return { ok: false, error: "StoreHub not configured", ...base };

  try {
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
    const [txns, shProducts, shCustomers] = await Promise.all([
      shGet<SHTransaction[]>(
        `/transactions?from=${from.toISOString()}&to=${to.toISOString()}`,
        cfg,
      ),
      shGet<SHProduct[]>("/products", cfg),
      shGet<SHCustomer[]>("/customers", cfg),
    ]);

    const productNameById = new Map(shProducts.map((p) => [p.id, p.name]));
    const memberByRefId = new Map(shCustomers.map((c) => [c.refId, c]));

    const crmProducts = await prisma.product.findMany({ select: { id: true, name: true, sku: true } });
    const productIndex = buildProductIndex(crmProducts);

    const summary = { ...base };
    const customerIdByPhone = new Map<string, string>();

    for (const t of txns) {
      summary.fetched++;
      if (t.isCancelled || t.transactionType !== "Sale") {
        summary.skippedCancelled++;
        continue;
      }

      // Dedupe on the receipt number (what the CSV import stored).
      const ref = t.invoiceNumber;
      if (ref) {
        const dup = await prisma.transaction.findFirst({ where: { storehubRef: ref } });
        if (dup) {
          summary.skippedDuplicate++;
          continue;
        }
      }

      // Resolve a linked member (most sales have none).
      let customerId: string | null = null;
      let rawPhone: string | null = null;
      const member = t.customerRefId ? memberByRefId.get(t.customerRefId) : undefined;
      const memberPhone = member?.phone ? normalizePhone(member.phone) : null;
      if (memberPhone) {
        rawPhone = memberPhone;
        const cached = customerIdByPhone.get(memberPhone);
        if (cached) {
          customerId = cached;
        } else {
          let cust = await findExistingCustomer({ phone: memberPhone });
          if (!cust) {
            cust = await prisma.customer.create({
              data: {
                phone: memberPhone,
                name: member ? fullName(member) : null,
                source: "STOREHUB",
                needsDetails: !(member && fullName(member)),
              },
            });
          }
          customerId = cust.id;
          customerIdByPhone.set(memberPhone, customerId);
        }
        if (customerId) summary.linkedToCustomer++;
      }

      // Line items: label by StoreHub product name, match to CRM catalogue.
      const lineCreates = (t.items ?? []).map((it) => {
        const rawProductName = productNameById.get(it.productId) ?? `StoreHub item ${it.productId}`;
        const productId = matchProduct(rawProductName, productIndex);
        if (productId) summary.linesMatched++;
        else summary.linesUnmatched++;
        return {
          productId,
          rawProductName,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          lineTotal: it.total,
        };
      });

      await prisma.transaction.create({
        data: {
          customerId,
          store: STORE_BY_ID[t.storeId] ?? "NONE",
          transactionDate: new Date(t.transactionTime),
          storehubRef: ref || null,
          rawPhone,
          totalAmount: t.total,
          lines: { create: lineCreates },
        },
      });
      summary.created++;
    }

    return { ok: true, ...summary };
  } catch (e) {
    return { ok: false, error: (e as Error).message, ...base };
  }
}

// ---------------------------------------------------------------------------
// On-demand freshness: pull the latest StoreHub sales into the CRM when a page
// that shows live figures (e.g. Revenue mix) is opened, so the numbers reflect
// today's takings without anyone clicking "sync".
//
// Throttled per server instance so rapid reloads don't hammer the API, and
// fully fail-safe — if StoreHub is unconfigured/slow/down it just returns and
// the page renders whatever is already imported. Never throws.
// ---------------------------------------------------------------------------
let lastAutoSyncAt = 0;
const AUTO_SYNC_MIN_INTERVAL_MS = 5 * 60 * 1000; // at most once / 5 min per instance

export async function refreshRecentTransactions(opts?: {
  days?: number;
  force?: boolean;
}): Promise<boolean> {
  if (!storeHubConfigured()) return false;
  const now = Date.now();
  if (!opts?.force && now - lastAutoSyncAt < AUTO_SYNC_MIN_INTERVAL_MS) return false;
  lastAutoSyncAt = now;
  try {
    const r = await syncStoreHubTransactions(opts?.days ?? 2);
    return r.ok;
  } catch {
    return false;
  }
}
