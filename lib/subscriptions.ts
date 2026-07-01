// =============================================================================
// Subscription bridge (Phase 3).
//
// Turns a predicted refill into managed recurring revenue. An active
// subscription suppresses that product from the customer's manual refill list
// and instead drives a SUBSCRIPTION_DUE task at each nextDueDate. Marking that
// task done advances the cycle. Also exposes the recurring-revenue estimate.
//
// Subscriptions are linked to their due-tasks by (customerId, productId): the
// convert action enforces at most one ACTIVE subscription per pair, so that key
// is unambiguous and no Task↔Subscription foreign key is needed.
// =============================================================================

import { prisma } from "./db";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DAYS_PER_MONTH = 30.44; // average, for monthly-value estimates

/** Estimated recurring monthly value of one subscription line. */
export function monthlyValue(retailPrice: number | null, intervalDays: number): number {
  if (!retailPrice || intervalDays <= 0) return 0;
  return (retailPrice * DAYS_PER_MONTH) / intervalDays;
}

/** Set of `${customerId}:${productId}` that currently have an ACTIVE subscription. */
export async function activeSubscriptionKeySet(): Promise<Set<string>> {
  const subs = await prisma.subscription.findMany({
    where: { status: "ACTIVE" },
    select: { customerId: true, productId: true },
  });
  return new Set(subs.map((s) => `${s.customerId}:${s.productId}`));
}

/** Estimated recurring monthly revenue across all ACTIVE subscriptions (RM). */
export async function estimatedMrr(): Promise<number> {
  const subs = await prisma.subscription.findMany({
    where: { status: "ACTIVE" },
    select: { intervalDays: true, product: { select: { retailPrice: true } } },
  });
  return subs.reduce((sum, s) => sum + monthlyValue(s.product.retailPrice, s.intervalDays), 0);
}

/** True when this customer already has an ACTIVE subscription for this product. */
export async function hasActiveSubscription(customerId: string, productId: string): Promise<boolean> {
  const found = await prisma.subscription.findFirst({
    where: { customerId, productId, status: "ACTIVE" },
    select: { id: true },
  });
  return found != null;
}

// ---------------------------------------------------------------------------
// Reconcile — spawn a SUBSCRIPTION_DUE task for each ACTIVE subscription that has
// reached its nextDueDate and doesn't already have one open. Run on dashboard
// load + the eod cron (like the hold sweep / membership reconcile).
// ---------------------------------------------------------------------------
export async function reconcileSubscriptions(now: Date = new Date()): Promise<number> {
  const due = await prisma.subscription.findMany({
    where: { status: "ACTIVE", nextDueDate: { lte: now } },
    select: { id: true, customerId: true, petId: true, productId: true, nextDueDate: true },
  });

  let created = 0;
  for (const s of due) {
    const existing = await prisma.task.findFirst({
      where: {
        customerId: s.customerId,
        productId: s.productId,
        type: "SUBSCRIPTION_DUE",
        status: { in: ["OPEN", "SNOOZED"] },
      },
      select: { id: true },
    });
    if (existing) continue;

    const cust = await prisma.customer.findUnique({
      where: { id: s.customerId },
      select: { preferredStore: true },
    });
    await prisma.task.create({
      data: {
        type: "SUBSCRIPTION_DUE",
        source: "SYSTEM",
        channel: "WHATSAPP",
        store: cust?.preferredStore ?? "NONE",
        customerId: s.customerId,
        petId: s.petId,
        productId: s.productId,
        dueAt: s.nextDueDate,
      },
    });
    created++;
  }
  return created;
}

/**
 * Advance a subscription's cycle after its due-task is fulfilled: push
 * nextDueDate forward by intervalDays until it's in the future, so the next
 * reminder fires one interval on (and a long-overdue one doesn't immediately
 * re-fire).
 */
export async function advanceSubscriptionCycle(
  customerId: string,
  productId: string,
  now: Date = new Date(),
): Promise<void> {
  const sub = await prisma.subscription.findFirst({
    where: { customerId, productId, status: "ACTIVE" },
    select: { id: true, nextDueDate: true, intervalDays: true },
  });
  if (!sub) return;

  const interval = sub.intervalDays > 0 ? sub.intervalDays : 30;
  let next = new Date(sub.nextDueDate);
  do {
    next = new Date(next.getTime() + interval * MS_PER_DAY);
  } while (next <= now);

  await prisma.subscription.update({ where: { id: sub.id }, data: { nextDueDate: next } });
}
