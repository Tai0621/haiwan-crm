"use server";

// =============================================================================
// Brand pipeline actions (Phase 4). Auth re-checked per action.
// =============================================================================

import { prisma } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type SupplierType = "TRADING" | "CONSIGNMENT" | "INHOUSE" | "CO_CREATION";
type BrandStatus = "PROSPECT" | "IN_TALKS" | "TRIAL" | "ACTIVE" | "DROPPED";
type AestheticFit = "HIGH" | "CONDITIONAL" | "VERIFY" | "SKIP";

async function requireSession() {
  if (!(await isAuthenticated())) throw new Error("Unauthorized");
}

function fields(formData: FormData) {
  const str = (k: string) => (String(formData.get(k) ?? "").trim() || null);
  const num = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v ? parseFloat(v) : null;
  };
  const date = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v ? new Date(v) : null;
  };
  return {
    name: str("name"),
    website: str("website"),
    country: str("country"),
    supplierType: (String(formData.get("supplierType") ?? "") as SupplierType) || "TRADING",
    status: (String(formData.get("status") ?? "") as BrandStatus) || "PROSPECT",
    owner: str("owner"),
    nextStep: str("nextStep"),
    listingFee: num("listingFee"),
    commissionPct: num("commissionPct"),
    trialStartDate: date("trialStartDate"),
    aestheticFit: (String(formData.get("aestheticFit") ?? "") as AestheticFit) || null,
    notes: str("notes"),
  };
}

export async function createBrand(formData: FormData) {
  await requireSession();
  const f = fields(formData);
  if (!f.name) throw new Error("Brand name is required.");
  // Starting a brand straight in TRIAL with no date starts the 90-day clock now.
  const trialStartDate = f.status === "TRIAL" ? f.trialStartDate ?? new Date() : f.trialStartDate;

  const brand = await prisma.brand.create({ data: { ...f, name: f.name, trialStartDate } });
  revalidatePath("/brands");
  redirect(`/brands/${brand.id}`);
}

export async function updateBrand(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing brand id.");
  const f = fields(formData);
  if (!f.name) throw new Error("Brand name is required.");
  const trialStartDate = f.status === "TRIAL" ? f.trialStartDate ?? new Date() : f.trialStartDate;

  await prisma.brand.update({ where: { id }, data: { ...f, name: f.name, trialStartDate } });
  revalidatePath(`/brands/${id}`);
  revalidatePath("/brands");
}

/** Quick status move from the pipeline board. Starts the trial clock on →TRIAL. */
export async function setBrandStatus(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as BrandStatus;
  if (!id || !status) throw new Error("Missing brand id or status.");

  const brand = await prisma.brand.findUnique({ where: { id }, select: { trialStartDate: true } });
  await prisma.brand.update({
    where: { id },
    data: {
      status,
      trialStartDate: status === "TRIAL" ? brand?.trialStartDate ?? new Date() : brand?.trialStartDate ?? null,
    },
  });
  revalidatePath("/brands");
  revalidatePath(`/brands/${id}`);
}
