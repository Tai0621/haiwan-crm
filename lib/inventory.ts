// =============================================================================
// Centralized per-store inventory.
//
// Product.stockKL / stockPJ are the live counts; every change flows through
// this module as a signed StockMovement row (the audit ledger), so counts are
// always explainable. Sources of change:
//   • SALE        — new transactions (StoreHub sync + manual entry) auto-deduct
//   • RESTOCK     — goods in (WhatsApp agent, paste box, or manual form)
//   • TRANSFER    — between stores (two rows sharing a groupId)
//   • ADJUSTMENT  — stock take / "set count" corrections
// Wix's single-pool figure is kept as a drift reference only.
// =============================================================================

import { prisma } from "./db";
import type { Store, StockMovementType, StockSource } from "../app/generated/prisma/client";

export type StockStore = "KL" | "PJ";

/** One parsed line of a WhatsApp/pasted stock message (StockUpdate.itemsJson). */
export interface StockUpdateItem {
  action: "restock" | "transfer" | "set";
  productName: string; // as understood by the agent
  productId: string | null; // matched against the catalog; null = unmatched
  qty: number;
  store?: StockStore | null; // restock & set
  fromStore?: StockStore | null; // transfer
  toStore?: StockStore | null;
  // Receive & check (restock lines): what staff physically counted, and any
  // per-line remark ("2 bags damaged"). Stock is updated with receivedQty.
  receivedQty?: number | null;
  checkNote?: string | null;
}

interface MovementInput {
  productId: string;
  store: StockStore;
  delta: number;
  type: StockMovementType;
  source: StockSource;
  groupId?: string;
  note?: string | null;
  transactionId?: string;
  stockUpdateId?: string;
  createdBy?: string | null;
}

const stockField = (store: StockStore): "stockKL" | "stockPJ" =>
  store === "KL" ? "stockKL" : "stockPJ";

/**
 * Write a batch of movements and bump the product counts atomically. This is
 * the ONLY place stock counts change.
 */
async function applyMovements(entries: MovementInput[]): Promise<void> {
  if (entries.length === 0) return;
  await prisma.$transaction([
    prisma.stockMovement.createMany({
      data: entries.map((e) => ({
        productId: e.productId,
        store: e.store as Store,
        delta: e.delta,
        type: e.type,
        source: e.source,
        groupId: e.groupId ?? null,
        note: e.note ?? null,
        transactionId: e.transactionId ?? null,
        stockUpdateId: e.stockUpdateId ?? null,
        createdBy: e.createdBy ?? null,
      })),
    }),
    ...entries.map((e) =>
      prisma.product.update({
        where: { id: e.productId },
        data: { [stockField(e.store)]: { increment: e.delta } },
      }),
    ),
  ]);
}

// ---------------------------------------------------------------------------
// Manual actions (quick forms on /inventory)
// ---------------------------------------------------------------------------

export async function restock(
  productId: string,
  store: StockStore,
  qty: number,
  opts: { note?: string | null; source?: StockSource; stockUpdateId?: string; by?: string | null } = {},
): Promise<void> {
  if (!Number.isFinite(qty) || qty <= 0) throw new Error("Quantity must be a positive number.");
  await applyMovements([
    {
      productId,
      store,
      delta: Math.round(qty),
      type: "RESTOCK",
      source: opts.source ?? "MANUAL",
      note: opts.note,
      stockUpdateId: opts.stockUpdateId,
      createdBy: opts.by,
    },
  ]);
}

export async function transfer(
  productId: string,
  from: StockStore,
  to: StockStore,
  qty: number,
  opts: { note?: string | null; source?: StockSource; stockUpdateId?: string; by?: string | null } = {},
): Promise<void> {
  if (from === to) throw new Error("Transfer needs two different stores.");
  if (!Number.isFinite(qty) || qty <= 0) throw new Error("Quantity must be a positive number.");
  const n = Math.round(qty);
  const groupId = `tr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const shared = {
    productId,
    type: "TRANSFER" as StockMovementType,
    source: opts.source ?? "MANUAL",
    groupId,
    note: opts.note,
    stockUpdateId: opts.stockUpdateId,
    createdBy: opts.by,
  };
  await applyMovements([
    { ...shared, store: from, delta: -n },
    { ...shared, store: to, delta: n },
  ]);
}

/** Stock take: set a store's count to an absolute number (records the delta). */
export async function setCount(
  productId: string,
  store: StockStore,
  newCount: number,
  opts: { note?: string | null; source?: StockSource; stockUpdateId?: string; by?: string | null } = {},
): Promise<void> {
  if (!Number.isFinite(newCount) || newCount < 0) throw new Error("Count must be zero or more.");
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { stockKL: true, stockPJ: true },
  });
  if (!product) throw new Error("Product not found.");
  const current = store === "KL" ? product.stockKL : product.stockPJ;
  const delta = Math.round(newCount) - current;
  if (delta === 0) return;
  await applyMovements([
    {
      productId,
      store,
      delta,
      type: "ADJUSTMENT",
      source: opts.source ?? "MANUAL",
      note: opts.note ?? `Stock take: set ${store} to ${Math.round(newCount)}`,
      stockUpdateId: opts.stockUpdateId,
      createdBy: opts.by,
    },
  ]);
}

// ---------------------------------------------------------------------------
// Sale deductions — called after a NEW transaction is created (StoreHub sync
// and manual entry). Idempotent per transaction; fail-safe (never breaks the
// sync); skips store NONE (online) and unmatched lines.
// ---------------------------------------------------------------------------

export async function recordSaleDeductions(transactionId: string): Promise<number> {
  try {
    const txn = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: {
        store: true,
        lines: { select: { productId: true, quantity: true } },
      },
    });
    if (!txn || txn.store === "NONE") return 0;

    const already = await prisma.stockMovement.findFirst({
      where: { transactionId },
      select: { id: true },
    });
    if (already) return 0;

    const entries: MovementInput[] = [];
    for (const line of txn.lines) {
      if (!line.productId) continue;
      const qty = Math.round(line.quantity);
      if (qty <= 0) continue;
      entries.push({
        productId: line.productId,
        store: txn.store as StockStore,
        delta: -qty,
        type: "SALE",
        source: "STOREHUB",
        transactionId,
      });
    }
    await applyMovements(entries);
    return entries.length;
  } catch (e) {
    console.error("recordSaleDeductions failed:", e);
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Applying a parsed StockUpdate (the WhatsApp/paste agent's output).
// ---------------------------------------------------------------------------

export function parseItems(json: string): StockUpdateItem[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as StockUpdateItem[]) : [];
  } catch {
    return [];
  }
}

/** Human-readable problems that block an update from being applied. */
export function updateProblems(items: StockUpdateItem[]): string[] {
  const problems: string[] = [];
  if (items.length === 0) problems.push("No items were recognised in the message.");
  items.forEach((it, i) => {
    const n = `Item ${i + 1} (${it.productName || "?"})`;
    if (!it.productId) problems.push(`${n}: no matching product in the catalog.`);
    if (!Number.isFinite(it.qty) || it.qty <= 0) problems.push(`${n}: quantity missing or invalid.`);
    if (it.action === "restock" || it.action === "set") {
      if (it.store !== "KL" && it.store !== "PJ") problems.push(`${n}: store (KL/PJ) not specified.`);
    } else if (it.action === "transfer") {
      if (it.fromStore !== "KL" && it.fromStore !== "PJ") problems.push(`${n}: transfer origin store missing.`);
      if (it.toStore !== "KL" && it.toStore !== "PJ") problems.push(`${n}: transfer destination store missing.`);
      if (it.fromStore && it.toStore && it.fromStore === it.toStore) problems.push(`${n}: transfer stores are the same.`);
    } else {
      problems.push(`${n}: unknown action "${it.action}".`);
    }
  });
  return problems;
}

/** Apply a PENDING StockUpdate: turn its items into movements + count bumps. */
export async function applyStockUpdate(id: string, appliedBy?: string | null): Promise<void> {
  const update = await prisma.stockUpdate.findUnique({ where: { id } });
  if (!update) throw new Error("Update not found.");
  if (update.status !== "PENDING") throw new Error("This update was already handled.");

  const items = parseItems(update.itemsJson);
  const problems = updateProblems(items);
  if (problems.length) {
    await prisma.stockUpdate.update({ where: { id }, data: { error: problems.join(" ") } });
    throw new Error(problems.join(" "));
  }

  const source = update.source === "WHATSAPP" ? "WHATSAPP" : "PASTE";
  for (const it of items) {
    const note = `${update.summary ?? "Stock update"}`;
    if (it.action === "restock") {
      await restock(it.productId!, it.store as StockStore, it.qty, { source, stockUpdateId: id, note, by: appliedBy });
    } else if (it.action === "transfer") {
      await transfer(it.productId!, it.fromStore as StockStore, it.toStore as StockStore, it.qty, { source, stockUpdateId: id, note, by: appliedBy });
    } else {
      await setCount(it.productId!, it.store as StockStore, it.qty, { source, stockUpdateId: id, note, by: appliedBy });
    }
  }

  await prisma.stockUpdate.update({
    where: { id },
    data: { status: "APPLIED", appliedAt: new Date(), appliedBy: appliedBy ?? null, error: null },
  });
}

// ---------------------------------------------------------------------------
// Receive & check — apply a restock-bearing update with PHYSICALLY COUNTED
// quantities. Counted numbers win (stock reflects reality); any variance from
// the list is recorded as a StockDiscrepancy and rolled into one follow-up
// task in the Action Inbox so someone chases the supplier.
// ---------------------------------------------------------------------------

export interface ReceivedCount {
  index: number; // position in the update's items array (restock lines only)
  receivedQty: number;
  note?: string | null;
}

export async function verifyAndApplyStockUpdate(
  id: string,
  counts: ReceivedCount[],
  checkedBy: string,
): Promise<{ discrepancies: number }> {
  const update = await prisma.stockUpdate.findUnique({ where: { id } });
  if (!update) throw new Error("Update not found.");
  if (update.status !== "PENDING") throw new Error("This update was already handled.");
  const who = checkedBy.trim();
  if (!who) throw new Error("Enter who checked the goods.");

  const items = parseItems(update.itemsJson);
  const problems = updateProblems(items);
  if (problems.length) {
    await prisma.stockUpdate.update({ where: { id }, data: { error: problems.join(" ") } });
    throw new Error(problems.join(" "));
  }

  // Merge the counted quantities into the restock lines (default = as listed).
  const byIndex = new Map(counts.map((c) => [c.index, c]));
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.action !== "restock") continue;
    const c = byIndex.get(i);
    const received = c ? Math.round(c.receivedQty) : it.qty;
    if (!Number.isFinite(received) || received < 0) throw new Error(`Item ${i + 1}: counted quantity must be 0 or more.`);
    it.receivedQty = received;
    it.checkNote = c?.note?.trim() || null;
  }

  const source = update.source === "WHATSAPP" ? "WHATSAPP" : "PASTE";
  const now = new Date();
  const discrepancies: { productId: string; productName: string; store: StockStore; expected: number; received: number; note: string | null }[] = [];

  for (const it of items) {
    const baseNote = update.summary ?? "Stock update";
    if (it.action === "restock") {
      const received = it.receivedQty ?? it.qty;
      const varies = received !== it.qty;
      if (varies) {
        discrepancies.push({
          productId: it.productId!,
          productName: it.productName,
          store: it.store as StockStore,
          expected: it.qty,
          received,
          note: it.checkNote ?? null,
        });
      }
      if (received > 0) {
        await restock(it.productId!, it.store as StockStore, received, {
          source,
          stockUpdateId: id,
          by: who,
          note: varies ? `${baseNote} — verified: listed ${it.qty}, counted ${received}` : `${baseNote} — verified`,
        });
      }
    } else if (it.action === "transfer") {
      await transfer(it.productId!, it.fromStore as StockStore, it.toStore as StockStore, it.qty, { source, stockUpdateId: id, note: baseNote, by: who });
    } else {
      await setCount(it.productId!, it.store as StockStore, it.qty, { source, stockUpdateId: id, note: baseNote, by: who });
    }
  }

  if (discrepancies.length) {
    await prisma.stockDiscrepancy.createMany({
      data: discrepancies.map((d) => ({
        stockUpdateId: id,
        productId: d.productId,
        productName: d.productName,
        store: d.store as Store,
        expected: d.expected,
        received: d.received,
        note: d.note,
        checkedBy: who,
      })),
    });
    // One follow-up task per delivery, listing every variance.
    const lines = discrepancies
      .map((d) => `${d.productName}: listed ${d.expected}, received ${d.received}${d.note ? ` (${d.note})` : ""}`)
      .join("; ");
    await prisma.task.create({
      data: {
        type: "CUSTOM",
        source: "SYSTEM",
        channel: "SYSTEM",
        store: discrepancies[0].store as Store,
        dueAt: now,
        note: `Delivery discrepancy — follow up with supplier. ${lines}`,
      },
    });
  }

  await prisma.stockUpdate.update({
    where: { id },
    data: {
      itemsJson: JSON.stringify(items),
      status: "APPLIED",
      appliedAt: now,
      appliedBy: who,
      verifiedBy: who,
      verifiedAt: now,
      error: null,
    },
  });

  return { discrepancies: discrepancies.length };
}

// ---------------------------------------------------------------------------
// Queries for the /inventory page.
// ---------------------------------------------------------------------------

export async function lowStockThreshold(): Promise<number> {
  const s = await prisma.appSetting.findUnique({ where: { id: "default" } });
  return s?.lowStockThreshold ?? 5;
}

export interface StockSummary {
  totalSkus: number;
  low: number; // total on hand at/below threshold (but not out)
  out: number; // total on hand <= 0
  pendingUpdates: number;
}

export async function stockSummary(threshold: number): Promise<StockSummary> {
  const [products, pendingUpdates] = await Promise.all([
    prisma.product.findMany({ select: { stockKL: true, stockPJ: true } }),
    prisma.stockUpdate.count({ where: { status: "PENDING" } }),
  ]);
  let low = 0;
  let out = 0;
  for (const p of products) {
    const total = p.stockKL + p.stockPJ;
    if (total <= 0) out++;
    else if (total <= threshold) low++;
  }
  return { totalSkus: products.length, low, out, pendingUpdates };
}
