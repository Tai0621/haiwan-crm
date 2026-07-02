"use server";

// =============================================================================
// SOP checklist editor actions (management only). Staff never reach these — the
// proxy blocks /shift/edit for frontline and the UI is hidden — but each action
// re-checks management anyway (Server Actions are POST-reachable).
// =============================================================================

import { prisma } from "@/lib/db";
import { requireManagement } from "@/lib/auth";
import { SECTIONS } from "@/lib/shift-checklist";
import { revalidatePath } from "next/cache";

const SECTION_ORDER: Record<string, number> = Object.fromEntries(SECTIONS.map((s) => [s.title, s.order]));

type Scope = "OPENING" | "CLOSING" | "BOTH";

function parse(formData: FormData) {
  const section = String(formData.get("section") ?? "").trim();
  return {
    section,
    sectionOrder: SECTION_ORDER[section] ?? 50,
    shift: (String(formData.get("shift") ?? "BOTH") as Scope) || "BOTH",
    pjShift: (String(formData.get("pjShift") ?? "") as Scope) || null,
    label: String(formData.get("label") ?? "").trim(),
    note: String(formData.get("note") ?? "").trim() || null,
    priority: String(formData.get("priority") ?? "med"),
    storeKL: formData.get("storeKL") != null,
    storePJ: formData.get("storePJ") != null,
    sortOrder: parseInt(String(formData.get("sortOrder") ?? "0"), 10) || 0,
  };
}

function refresh() {
  revalidatePath("/shift/edit");
  revalidatePath("/shift");
}

export async function createChecklistItem(formData: FormData) {
  await requireManagement();
  const d = parse(formData);
  if (!d.section || !d.label) throw new Error("Section and label are required.");
  if (!d.storeKL && !d.storePJ) throw new Error("Pick at least one branch.");
  await prisma.shiftChecklistItem.create({ data: d });
  refresh();
}

export async function updateChecklistItem(formData: FormData) {
  await requireManagement();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing item id.");
  const d = parse(formData);
  if (!d.label) throw new Error("Label is required.");
  await prisma.shiftChecklistItem.update({
    where: { id },
    data: { ...d, active: formData.get("active") != null },
  });
  refresh();
}

export async function deleteChecklistItem(formData: FormData) {
  await requireManagement();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing item id.");
  await prisma.shiftChecklistItem.delete({ where: { id } });
  refresh();
}
