"use server";

// =============================================================================
// Membership actions (Phase 2). Auth re-checked per action (Server Actions are
// POST-reachable). Activation/claim is the same motion as data-enrichment.
// =============================================================================

import { prisma } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { claimMembership } from "@/lib/membership";
import { revalidatePath } from "next/cache";

async function requireSession() {
  if (!(await isAuthenticated())) throw new Error("Unauthorized");
}

function revalidateMember() {
  revalidatePath("/members");
  revalidatePath("/customers/[id]", "page");
  revalidatePath("/");
}

/** Claim/activate a customer's membership. */
export async function claimMembershipAction(formData: FormData) {
  await requireSession();
  const id = String(formData.get("customerId") ?? "");
  if (!id) throw new Error("Missing customer id.");
  await claimMembership(id);
  revalidateMember();
}

/** Queue an ACTIVATION follow-up task for a prospect (shows in the inbox). */
export async function queueActivation(formData: FormData) {
  await requireSession();
  const id = String(formData.get("customerId") ?? "");
  if (!id) throw new Error("Missing customer id.");

  const existing = await prisma.task.findFirst({
    where: { customerId: id, type: "ACTIVATION", status: { in: ["OPEN", "SNOOZED"] } },
    select: { id: true },
  });
  if (!existing) {
    const customer = await prisma.customer.findUnique({ where: { id }, select: { preferredStore: true } });
    await prisma.task.create({
      data: {
        type: "ACTIVATION",
        source: "MANUAL",
        channel: "WHATSAPP",
        store: customer?.preferredStore ?? "NONE",
        customerId: id,
        dueAt: new Date(),
        note: "Invite this past customer to claim their membership.",
      },
    });
  }
  revalidateMember();
}

/** Adjust a member's points balance by a (signed) delta. */
export async function adjustPoints(formData: FormData) {
  await requireSession();
  const id = String(formData.get("customerId") ?? "");
  const delta = parseInt(String(formData.get("delta") ?? "0"), 10);
  if (!id || !Number.isFinite(delta) || delta === 0) return;
  await prisma.customer.update({
    where: { id },
    data: { pointsBalance: { increment: delta } },
  });
  revalidateMember();
}
