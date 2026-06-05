"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// Parse an optional float from a form value ("" -> null).
function optFloat(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function buildData(formData: FormData) {
  const sku = String(formData.get("sku") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!sku) throw new Error("SKU is required.");
  if (!name) throw new Error("Product name is required.");

  return {
    sku,
    name,
    brand: (formData.get("brand") as string)?.trim() || null,
    category: (String(formData.get("category") ?? "").trim()) || "other",
    targetSpecies: (formData.get("targetSpecies") as "DOG" | "CAT" | "ANY") || "ANY",
    lifeStage:
      (formData.get("lifeStage") as "PUPPY_KITTEN" | "ADULT" | "SENIOR" | "ANY") || "ANY",
    packSize: optFloat(formData.get("packSize")),
    packUnit: ((formData.get("packUnit") as string) || "") as
      | "G"
      | "KG"
      | "ML"
      | "L"
      | "COUNT"
      | "",
    supplierType:
      (formData.get("supplierType") as "TRADING" | "CONSIGNMENT" | "INHOUSE") || "TRADING",
    costPrice: optFloat(formData.get("costPrice")),
    retailPrice: optFloat(formData.get("retailPrice")),
    isConsumable: formData.get("isConsumable") === "on",
  };
}

export async function createProduct(formData: FormData) {
  const data = buildData(formData);
  const product = await prisma.product.create({
    data: {
      ...data,
      packUnit: data.packUnit === "" ? null : data.packUnit,
    },
  });
  revalidatePath("/products");
  redirect(`/products/${product.id}/edit`);
}

export async function updateProduct(formData: FormData) {
  const id = String(formData.get("id"));
  const data = buildData(formData);
  await prisma.product.update({
    where: { id },
    data: {
      ...data,
      packUnit: data.packUnit === "" ? null : data.packUnit,
    },
  });
  revalidatePath("/products");
  revalidatePath(`/products/${id}/edit`);
  redirect("/products");
}

export async function deleteProduct(formData: FormData) {
  const id = String(formData.get("id"));
  // Keep historical transaction lines, just unlink the product (productId -> null).
  await prisma.transactionLine.updateMany({
    where: { productId: id },
    data: { productId: null },
  });
  await prisma.subscription.deleteMany({ where: { productId: id } });
  await prisma.product.delete({ where: { id } });
  revalidatePath("/products");
  redirect("/products");
}
