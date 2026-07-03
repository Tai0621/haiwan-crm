"use server";

// =============================================================================
// Inventory actions. View/submit/apply are open to both roles (receiving stock
// is store-level work and Apply is already a review step); set-count and the
// low-stock threshold are management-only. All re-check auth (Server Actions
// are POST-reachable).
// =============================================================================

import { prisma } from "@/lib/db";
import { isAuthenticated, requireManagement } from "@/lib/auth";
import { restock, transfer, setCount, applyStockUpdate, type StockStore } from "@/lib/inventory";
import { parseStockMessage, type ParseResult } from "@/lib/stock-agent";
import { buildProductIndex, matchProduct } from "@/lib/match";
import { revalidatePath } from "next/cache";

async function requireSession() {
  if (!(await isAuthenticated())) throw new Error("Unauthorized");
}

function refresh() {
  revalidatePath("/inventory");
}

/** Resolve a typed product name/SKU to a product id using the shared matcher. */
async function resolveProduct(raw: string): Promise<string> {
  const term = raw.trim();
  if (!term) throw new Error("Type a product name or SKU.");
  const products = await prisma.product.findMany({ select: { id: true, name: true, sku: true } });
  const bySku = products.find((p) => p.sku.toLowerCase() === term.toLowerCase());
  if (bySku) return bySku.id;
  const id = matchProduct(term, buildProductIndex(products));
  if (!id) throw new Error(`No product matches "${term}". Try the exact name or SKU.`);
  return id;
}

const asStore = (v: FormDataEntryValue | null): StockStore => {
  const s = String(v ?? "");
  if (s !== "KL" && s !== "PJ") throw new Error("Pick a store (KL or PJ).");
  return s;
};

// --- Paste box: parse a free-text stock message via the agent ---------------
export async function submitStockMessage(rawText: string): Promise<ParseResult> {
  await requireSession();
  const result = await parseStockMessage(rawText, "PASTE");
  if (result.ok) refresh();
  return result;
}

// --- Pending updates ---------------------------------------------------------
export async function applyUpdate(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing update id.");
  await applyStockUpdate(id);
  refresh();
}

export async function dismissUpdate(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing update id.");
  await prisma.stockUpdate.update({ where: { id }, data: { status: "DISMISSED" } });
  refresh();
}

// --- Quick manual actions ------------------------------------------------------
export async function manualRestock(formData: FormData) {
  await requireSession();
  const productId = await resolveProduct(String(formData.get("product") ?? ""));
  const store = asStore(formData.get("store"));
  const qty = parseInt(String(formData.get("qty") ?? "0"), 10);
  const note = String(formData.get("note") ?? "").trim() || null;
  await restock(productId, store, qty, { note });
  refresh();
}

export async function manualTransfer(formData: FormData) {
  await requireSession();
  const productId = await resolveProduct(String(formData.get("product") ?? ""));
  const from = asStore(formData.get("fromStore"));
  const to = asStore(formData.get("toStore"));
  const qty = parseInt(String(formData.get("qty") ?? "0"), 10);
  const note = String(formData.get("note") ?? "").trim() || null;
  await transfer(productId, from, to, qty, { note });
  refresh();
}

/** Stock take (management): set a store's count to an absolute number. */
export async function manualSetCount(formData: FormData) {
  await requireManagement();
  const productId = await resolveProduct(String(formData.get("product") ?? ""));
  const store = asStore(formData.get("store"));
  const count = parseInt(String(formData.get("count") ?? ""), 10);
  const note = String(formData.get("note") ?? "").trim() || null;
  await setCount(productId, store, count, { note });
  refresh();
}

/** Low-stock threshold (management). */
export async function setLowStockThreshold(formData: FormData) {
  await requireManagement();
  const raw = parseInt(String(formData.get("threshold") ?? ""), 10);
  const threshold = Number.isFinite(raw) ? Math.max(0, raw) : 5;
  await prisma.appSetting.upsert({
    where: { id: "default" },
    update: { lowStockThreshold: threshold },
    create: { id: "default", lowStockThreshold: threshold },
  });
  refresh();
}
