"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { rm, fmtDate } from "@/lib/format";
import { STORE_LABELS } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Transaction actions — manual entry of in-store sales that aren't covered by
// a StoreHub CSV import. Mirrors the importer's write shape (Transaction +
// nested TransactionLine[]), but lines come from the staff-entered form.
//
// Line fields arrive as parallel arrays (one entry per row), zipped by index —
// same approach the customer form uses for pets.
// ---------------------------------------------------------------------------

function linesFromForm(formData: FormData) {
  const productIds = formData.getAll("lineProductId").map(String);
  const names = formData.getAll("lineProductName").map(String);
  const qtys = formData.getAll("lineQty").map(String);
  const prices = formData.getAll("lineUnitPrice").map(String);

  const lines: {
    productId: string | null;
    rawProductName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[] = [];

  for (let i = 0; i < names.length; i++) {
    const rawProductName = (names[i] ?? "").trim();
    if (!rawProductName) continue; // skip blank rows
    const quantity = parseFloat(qtys[i] ?? "") || 0;
    const unitPrice = parseFloat(prices[i] ?? "") || 0;
    const productId = (productIds[i] ?? "").trim() || null;
    lines.push({
      productId,
      rawProductName,
      quantity,
      unitPrice,
      // round to cents to avoid float drift in the stored total
      lineTotal: Math.round(quantity * unitPrice * 100) / 100,
    });
  }
  return lines;
}

export async function createTransaction(formData: FormData) {
  const customerId = String(formData.get("customerId") ?? "").trim();
  if (!customerId) throw new Error("Please choose a customer.");

  const store = (String(formData.get("store") ?? "KL") || "KL") as "KL" | "PJ";
  const dateStr = String(formData.get("transactionDate") ?? "");
  const transactionDate = dateStr ? new Date(dateStr) : new Date();

  const lines = linesFromForm(formData);
  if (lines.length === 0) throw new Error("Add at least one line item.");

  const totalAmount =
    Math.round(lines.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100;

  await prisma.transaction.create({
    data: {
      customerId,
      store,
      transactionDate,
      totalAmount,
      // storehubRef stays null — that's how we tell manual entries from imports.
      lines: { create: lines },
    },
  });

  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/revenue");

  const returnTo = String(formData.get("returnTo") ?? "").trim();
  redirect(returnTo || `/customers/${customerId}`);
}

export async function deleteTransaction(formData: FormData) {
  const id = String(formData.get("id"));
  const returnTo = String(formData.get("returnTo") ?? "").trim();
  // Lines cascade-delete (onDelete: Cascade on TransactionLine).
  await prisma.transaction.delete({ where: { id } });

  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/customers");
  revalidatePath("/revenue");
  redirect(returnTo || "/transactions");
}

// ---------------------------------------------------------------------------
// Link / unlink an EXISTING (imported) transaction to a customer. This is how
// purchase history is attached on the customer page — staff pick from already
// imported transactions rather than re-keying a new one.
// ---------------------------------------------------------------------------

export async function linkTransaction(formData: FormData) {
  const transactionId = String(formData.get("transactionId") ?? "").trim();
  const customerId = String(formData.get("customerId") ?? "").trim();
  if (!transactionId) throw new Error("Please choose a transaction to link.");
  if (!customerId) throw new Error("Missing customer.");

  await prisma.transaction.update({
    where: { id: transactionId },
    data: { customerId },
  });

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  revalidatePath("/transactions");
  revalidatePath("/revenue");
}

export async function unlinkTransaction(formData: FormData) {
  const transactionId = String(formData.get("transactionId") ?? "").trim();
  const customerId = String(formData.get("customerId") ?? "").trim();

  await prisma.transaction.update({
    where: { id: transactionId },
    data: { customerId: null },
  });

  if (customerId) revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  revalidatePath("/transactions");
  revalidatePath("/revenue");
}

// Search UNLINKED transactions for the customer-page picker. Returns a small
// page of matches (never the whole table) so the customer page stays light.
export async function searchUnlinkedTransactions(
  query: string,
): Promise<{ id: string; label: string }[]> {
  const q = query.trim();
  const or: Array<Record<string, unknown>> = [];
  if (q) {
    or.push({ storehubRef: { contains: q } });
    or.push({ lines: { some: { rawProductName: { contains: q } } } });
    or.push({ lines: { some: { product: { name: { contains: q } } } } });
    const num = parseFloat(q);
    if (!Number.isNaN(num)) or.push({ totalAmount: num });
    if (/\b(kl|kuala)\b/i.test(q)) or.push({ store: "KL" });
    if (/\b(pj|petaling)\b/i.test(q)) or.push({ store: "PJ" });
  }

  const txns = await prisma.transaction.findMany({
    where: { customerId: null, ...(or.length ? { OR: or } : {}) },
    orderBy: { transactionDate: "desc" },
    take: 25,
    select: {
      id: true,
      transactionDate: true,
      store: true,
      totalAmount: true,
      storehubRef: true,
      lines: { select: { rawProductName: true, product: { select: { name: true } } }, take: 3 },
    },
  });

  return txns.map((t) => {
    const items = t.lines.map((l) => l.product?.name ?? l.rawProductName).filter(Boolean).join(", ");
    return {
      id: t.id,
      label: `${fmtDate(t.transactionDate)} · ${STORE_LABELS[t.store]} · ${rm(t.totalAmount)}${items ? ` · ${items}` : ""}${t.storehubRef ? ` · #${t.storehubRef}` : ""}`,
    };
  });
}
