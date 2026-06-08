"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
