"use server";

// =============================================================================
// Action Inbox mutations (Phase 1).
//
// Server Actions invoked from the dashboard's quick-add forms and inbox row
// buttons. Auth note: the whole app is gated by proxy.ts, but Server Actions are
// reachable by direct POST, so each action re-checks the session before writing.
// =============================================================================

import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { findExistingCustomer } from "@/lib/customer-resolve";
import { isAuthenticated } from "@/lib/auth";
import { advanceSubscriptionCycle } from "@/lib/subscriptions";
import { revalidatePath } from "next/cache";
import type { Store, TaskChannel } from "@/app/generated/prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;

async function requireSession() {
  if (!(await isAuthenticated())) throw new Error("Unauthorized");
}

function plusHours(h: number): Date {
  return new Date(Date.now() + h * 60 * 60 * 1000);
}

/**
 * Resolve an incoming (phone, name) to a customer, creating a stub record when
 * the phone is new — exactly like the import flows, so the inbox never spawns a
 * duplicate. Returns null when no usable phone was supplied.
 */
async function resolveOrStubCustomer(
  rawPhone: string,
  name: string | null,
  store: Store,
  channel: TaskChannel,
): Promise<{ id: string; preferredStore: Store } | null> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return null;

  const existing = await findExistingCustomer({ phone });
  if (existing) {
    // Fill in a name on a stub if we just learned it; never overwrite.
    if (name && !existing.name) {
      await prisma.customer.update({ where: { id: existing.id }, data: { name } });
    }
    return { id: existing.id, preferredStore: existing.preferredStore };
  }

  const created = await prisma.customer.create({
    data: {
      phone,
      name: name || null,
      preferredStore: store,
      source: channel === "WHATSAPP" ? "WHATSAPP" : channel === "WEBSITE" || channel === "INSTAGRAM" ? "OTHER" : "WALKIN",
      needsDetails: true, // staff should enrich later
    },
  });
  return { id: created.id, preferredStore: created.preferredStore };
}

// ---------------------------------------------------------------------------
// Quick-add: SOP §5 lead capture
// ---------------------------------------------------------------------------
export async function createLead(formData: FormData) {
  await requireSession();
  const name = String(formData.get("name") ?? "").trim() || null;
  const rawPhone = String(formData.get("phone") ?? "").trim();
  const item = String(formData.get("item") ?? "").trim() || null;
  const petNotes = String(formData.get("petNotes") ?? "").trim() || null;
  const store = (String(formData.get("store") ?? "NONE") as Store) || "NONE";

  if (!rawPhone) throw new Error("A phone number is required to follow up on a lead.");
  const customer = await resolveOrStubCustomer(rawPhone, name, store, "WALKIN");
  if (!customer) throw new Error("Could not read a valid phone number.");

  await prisma.task.create({
    data: {
      type: "LEAD_FOLLOWUP",
      source: "SOP_LEAD",
      channel: "WALKIN",
      store: store !== "NONE" ? store : customer.preferredStore,
      customerId: customer.id,
      holdItem: item, // the item they asked about (free text)
      note: petNotes,
      dueAt: plusHours(24),
    },
  });

  revalidatePath("/");
  revalidatePath("/customers");
}

// ---------------------------------------------------------------------------
// Quick-add: SOP §6 24-hour hold
// ---------------------------------------------------------------------------
export async function createHold(formData: FormData) {
  await requireSession();
  const name = String(formData.get("name") ?? "").trim() || null;
  const rawPhone = String(formData.get("phone") ?? "").trim();
  const item = String(formData.get("item") ?? "").trim();
  const store = (String(formData.get("store") ?? "NONE") as Store) || "NONE";

  if (!item) throw new Error("Describe the item being held.");
  if (!rawPhone) throw new Error("A phone number is required so we can follow up if the hold lapses.");

  const customer = await resolveOrStubCustomer(rawPhone, name, store, "WALKIN");
  if (!customer) throw new Error("Could not read a valid phone number.");

  const expires = plusHours(24);
  await prisma.task.create({
    data: {
      type: "HOLD",
      source: "SOP_HOLD",
      channel: "WALKIN",
      store: store !== "NONE" ? store : customer.preferredStore,
      customerId: customer.id,
      holdItem: item,
      holdExpiresAt: expires,
      dueAt: expires, // sort by when the reservation lapses
    },
  });

  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// Quick-add: inquiry intake (WhatsApp / website / Instagram)
// ---------------------------------------------------------------------------
export async function createInquiry(formData: FormData) {
  await requireSession();
  const name = String(formData.get("name") ?? "").trim() || null;
  const rawPhone = String(formData.get("phone") ?? "").trim();
  const channel = (String(formData.get("channel") ?? "WHATSAPP") as TaskChannel) || "WHATSAPP";
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!rawPhone) throw new Error("A phone number is required to reply to an inquiry.");
  const customer = await resolveOrStubCustomer(rawPhone, name, "NONE", channel);
  if (!customer) throw new Error("Could not read a valid phone number.");

  await prisma.task.create({
    data: {
      type: "INQUIRY",
      source: "MANUAL",
      channel,
      store: customer.preferredStore,
      customerId: customer.id,
      note,
      dueAt: plusHours(24), // 24h first-reply target
    },
  });

  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// Inbox row actions — Task rows
// ---------------------------------------------------------------------------
export async function markTaskDone(formData: FormData) {
  await requireSession();
  const id = String(formData.get("taskId") ?? "");
  if (!id) throw new Error("Missing task id.");
  const task = await prisma.task.update({
    where: { id },
    data: { status: "DONE", completedAt: new Date() },
    select: { type: true, customerId: true, productId: true },
  });

  // Completing a subscription reminder advances the subscription to its next
  // cycle so the reminder re-fires one interval on.
  if (task.type === "SUBSCRIPTION_DUE" && task.customerId && task.productId) {
    await advanceSubscriptionCycle(task.customerId, task.productId);
    revalidatePath("/subscriptions");
  }

  revalidatePath("/");
  revalidatePath("/customers/[id]", "page");
}

export async function snoozeTask(formData: FormData) {
  await requireSession();
  const id = String(formData.get("taskId") ?? "");
  const days = parseInt(String(formData.get("days") ?? "1"), 10) || 1;
  if (!id) throw new Error("Missing task id.");
  const until = new Date(Date.now() + days * DAY_MS);
  await prisma.task.update({
    where: { id },
    data: { status: "SNOOZED", snoozedUntil: until, dueAt: until },
  });
  revalidatePath("/");
  revalidatePath("/customers/[id]", "page");
}

// ---------------------------------------------------------------------------
// Inbox row actions — Refill rows (overlay state)
// ---------------------------------------------------------------------------
async function upsertOverlay(
  customerId: string,
  productId: string,
  cycleDate: Date,
  status: "DONE" | "SNOOZED",
  snoozedUntil: Date | null,
) {
  await prisma.refillOverlay.upsert({
    where: { customerId_productId: { customerId, productId } },
    update: { status, snoozedUntil, cycleDate },
    create: { customerId, productId, status, snoozedUntil, cycleDate },
  });
}

export async function markRefillDone(formData: FormData) {
  await requireSession();
  const customerId = String(formData.get("customerId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const cycleDate = new Date(String(formData.get("cycleDate") ?? ""));
  if (!customerId || !productId || isNaN(cycleDate.getTime())) throw new Error("Missing refill identity.");
  await upsertOverlay(customerId, productId, cycleDate, "DONE", null);
  revalidatePath("/");
  revalidatePath("/customers/[id]", "page");
}

export async function snoozeRefill(formData: FormData) {
  await requireSession();
  const customerId = String(formData.get("customerId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const cycleDate = new Date(String(formData.get("cycleDate") ?? ""));
  const days = parseInt(String(formData.get("days") ?? "1"), 10) || 1;
  if (!customerId || !productId || isNaN(cycleDate.getTime())) throw new Error("Missing refill identity.");
  await upsertOverlay(customerId, productId, cycleDate, "SNOOZED", new Date(Date.now() + days * DAY_MS));
  revalidatePath("/");
  revalidatePath("/customers/[id]", "page");
}
