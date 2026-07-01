// =============================================================================
// Action Inbox logic (Phase 1).
//
// The inbox is one dueAt-sorted list that merges two sources:
//   1. Tasks (manual SOP captures + system-spawned follow-ups) from the Task
//      table.
//   2. Refill predictions, computed live in lib/refill.ts, with their done/snooze
//      state read from the RefillOverlay table (the "overlay" approach: refills
//      are never stored, so clearing one persists only the overlay state).
//
// This module is a plain server module (no "use server"): it's imported by the
// dashboard Server Component to READ the inbox and by app/actions/tasks.ts to
// MUTATE it.
// =============================================================================

import { prisma } from "./db";
import { dueSoonPredictions, predictionsForCustomer, type RefillPrediction } from "./refill";
import { whatsappLink } from "./phone";
import { renderTemplate, templateKeyForTask, type TemplateKey } from "./templates";
import { REFILL_WINDOW_DAYS, categoryDefaultDays } from "./constants";
import { activeSubscriptionKeySet } from "./subscriptions";
import type { Prisma, Store, TaskType, TaskChannel, TaskStatus } from "../app/generated/prisma/client";

// Shared relation shape for loading tasks into inbox items.
const TASK_INCLUDE = {
  customer: { select: { name: true, phone: true, preferredStore: true } },
  pet: { select: { name: true } },
  product: { select: { name: true } },
} satisfies Prisma.TaskInclude;

type TaskRow = Prisma.TaskGetPayload<{ include: typeof TASK_INCLUDE }>;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export interface InboxItem {
  key: string; // stable React key
  kind: "task" | "refill";
  taskId?: string; // present when kind === "task"
  type: TaskType; // "REFILL" for refill rows

  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  petLabel: string | null;
  productName: string | null;

  store: Store;
  channel: TaskChannel;
  reason: string; // one-line human description of why this is here
  note: string | null;

  dueAt: Date;
  daysUntilDue: number; // negative = overdue
  isOverdue: boolean;
  holdExpiresAt: Date | null; // drives the live countdown for HOLD rows

  status: TaskStatus;
  whatsappUrl: string | null;

  // Refill-only identity, used by the overlay snooze/done + convert actions.
  refillProductId?: string;
  refillCycleDate?: Date;
  refillIntervalDays?: number; // predicted repurchase gap, for "Convert to subscription"

  // BRAND_REVIEW tasks point at a brand instead of a customer.
  brandId?: string;
  brandName?: string;
}

export interface InboxFilter {
  store?: Store | "ALL";
  type?: TaskType | "ALL";
}

function daysFromNow(d: Date, now: Date): number {
  return Math.ceil((d.getTime() - now.getTime()) / MS_PER_DAY);
}

/** Same calendar day? Used to decide if an overlay still applies to a cycle. */
function sameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

// ---------------------------------------------------------------------------
// Hold sweep — flip lapsed 24h holds to EXPIRED and spawn a courtesy follow-up.
// Called at the top of the inbox render (deterministic + testable) and also by
// the daily eod-analysis cron as a backstop. Idempotent: only OPEN holds past
// their expiry are touched, and the spawned follow-up has no holdExpiresAt so it
// is never re-swept.
// ---------------------------------------------------------------------------
export async function sweepExpiredHolds(now: Date = new Date()): Promise<number> {
  const expired = await prisma.task.findMany({
    where: { type: "HOLD", status: "OPEN", holdExpiresAt: { lte: now } },
    include: { customer: { select: { name: true } } },
  });

  for (const t of expired) {
    await prisma.task.update({
      where: { id: t.id },
      data: { status: "EXPIRED", completedAt: now },
    });
    // Spawn the "close the loop" follow-up: a single courtesy message telling the
    // customer the item was released. Carries holdItem so the inbox renders the
    // hold-lapse template; CUSTOM + no holdExpiresAt means it won't be re-swept.
    await prisma.task.create({
      data: {
        type: "CUSTOM",
        source: "SYSTEM",
        channel: "WHATSAPP",
        store: t.store,
        customerId: t.customerId,
        holdItem: t.holdItem,
        dueAt: now,
        note: `Hold lapsed — let ${t.customer?.name ?? "the customer"} know "${t.holdItem ?? "the reserved item"}" was released, and they're welcome to re-reserve.`,
      },
    });
  }

  return expired.length;
}

// ---------------------------------------------------------------------------
// Build the merged, sorted inbox.
// ---------------------------------------------------------------------------

/** Which template a task row should offer on its WhatsApp button. */
function templateForTask(type: TaskType, holdItem: string | null): TemplateKey {
  if (type === "HOLD") return "holdReserved"; // an active reservation
  if (type === "CUSTOM" && holdItem) return "holdLapse"; // a system lapse follow-up
  return templateKeyForTask(type);
}

function reasonForTask(type: TaskType, holdItem: string | null, productName: string | null): string {
  switch (type) {
    case "LEAD_FOLLOWUP":
      return `Follow up on ${holdItem ?? productName ?? "their enquiry"}`;
    case "INQUIRY":
      return "First reply to an inbound inquiry";
    case "HOLD":
      return `24h hold: ${holdItem ?? "reserved item"}`;
    case "ACTIVATION":
      return "Invite to claim membership";
    case "WINBACK":
      return "Win back a lapsed customer";
    case "SUBSCRIPTION_DUE":
      return `Subscription due: ${productName ?? "item"}`;
    case "BRAND_REVIEW":
      return "Brand 90-day trial review";
    case "REFILL":
      return `Refill: ${productName ?? "consumable"}`;
    default:
      return holdItem ? `Hold released: ${holdItem}` : "Follow-up";
  }
}

/** Resolve brand names for BRAND_REVIEW tasks (brandId is an app-side join). */
async function brandNameMap(tasks: { brandId: string | null }[]): Promise<Map<string, string>> {
  const ids = Array.from(new Set(tasks.map((t) => t.brandId).filter((x): x is string => !!x)));
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const brands = await prisma.brand.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  for (const b of brands) map.set(b.id, b.name);
  return map;
}

function taskToItem(t: TaskRow, now: Date, brandName?: string): InboxItem {
  const productName = t.product?.name ?? null;
  const tplKey = templateForTask(t.type, t.holdItem);
  const text = renderTemplate(tplKey, {
    customerName: t.customer?.name,
    petName: t.pet?.name,
    productName,
    holdItem: t.holdItem,
  });
  return {
    key: `task:${t.id}`,
    kind: "task",
    taskId: t.id,
    type: t.type,
    customerId: t.customerId,
    customerName: t.customer?.name ?? null,
    customerPhone: t.customer?.phone ?? null,
    petLabel: t.pet?.name ?? null,
    productName,
    store: t.store,
    channel: t.channel,
    reason: reasonForTask(t.type, t.holdItem, productName),
    note: t.note,
    dueAt: t.dueAt,
    daysUntilDue: daysFromNow(t.dueAt, now),
    isOverdue: t.dueAt < now,
    holdExpiresAt: t.holdExpiresAt,
    status: t.status,
    whatsappUrl: t.customer?.phone ? whatsappLink(t.customer.phone, text) : null,
    brandId: t.brandId ?? undefined,
    brandName,
  };
}

/**
 * True when an overlay should hide a refill prediction for its current cycle
 * (cleared as DONE, or snoozed and the snooze hasn't elapsed). A new purchase
 * moves the prediction to a different cycleDate, so the overlay stops matching
 * and the refill reappears.
 */
function overlayHidesRefill(
  overlay: { cycleDate: Date; status: TaskStatus; snoozedUntil: Date | null } | undefined,
  predictedNextDate: Date,
  now: Date,
): boolean {
  if (!overlay || !sameDay(overlay.cycleDate, predictedNextDate)) return false;
  if (overlay.status === "DONE") return true;
  if (overlay.status === "SNOOZED" && overlay.snoozedUntil && overlay.snoozedUntil > now) return true;
  return false;
}

function refillToItem(p: RefillPrediction, now: Date): InboxItem {
  const petLabel = p.petNames.join(", ") || null;
  const text = renderTemplate("refillNudge", {
    customerName: p.customerName,
    petNames: p.petNames,
    productName: p.productName,
  });
  return {
    key: `refill:${p.customerId}:${p.productId}`,
    kind: "refill",
    type: "REFILL",
    customerId: p.customerId,
    customerName: p.customerName,
    customerPhone: p.customerPhone,
    petLabel,
    productName: p.productName,
    store: "NONE",
    channel: "SYSTEM",
    reason: reasonForTask("REFILL", null, p.productName),
    note: p.basis === "category-default" ? "Estimated from category default (single purchase)" : null,
    dueAt: p.predictedNextDate,
    daysUntilDue: p.daysUntilDue,
    isOverdue: p.daysUntilDue < 0,
    holdExpiresAt: null,
    status: "OPEN",
    whatsappUrl: whatsappLink(p.customerPhone, text),
    refillProductId: p.productId,
    refillCycleDate: p.predictedNextDate,
    refillIntervalDays: p.avgGapDays != null ? Math.round(p.avgGapDays) : categoryDefaultDays(p.productCategory),
  };
}

/**
 * The merged inbox. Returns OPEN tasks (plus SNOOZED tasks whose snooze has
 * elapsed) merged with live refill predictions that haven't been cleared/snoozed
 * for their current cycle, sorted soonest-due first.
 */
export async function getInbox(filter: InboxFilter = {}): Promise<InboxItem[]> {
  const now = new Date();

  const [tasks, predictions, overlays] = await Promise.all([
    prisma.task.findMany({
      where: {
        OR: [
          { status: "OPEN" },
          { status: "SNOOZED", snoozedUntil: { lte: now } },
        ],
      },
      include: TASK_INCLUDE,
      orderBy: { dueAt: "asc" },
    }),
    dueSoonPredictions(),
    prisma.refillOverlay.findMany(),
  ]);
  const subscribed = await activeSubscriptionKeySet();

  // Brand names for any BRAND_REVIEW tasks (brandId is an app-side join).
  const brandNames = await brandNameMap(tasks);

  // Index overlays by customer:product for O(1) lookup during the merge.
  const overlayByKey = new Map<string, (typeof overlays)[number]>();
  for (const o of overlays) overlayByKey.set(`${o.customerId}:${o.productId}`, o);

  const items: InboxItem[] = [];

  // Tasks → items
  for (const t of tasks) items.push(taskToItem(t, now, t.brandId ? brandNames.get(t.brandId) : undefined));

  // Refills → items, skipping any cleared/snoozed for their current cycle, or any
  // product the customer now has an active subscription for (managed instead).
  for (const p of predictions) {
    if (subscribed.has(`${p.customerId}:${p.productId}`)) continue;
    const overlay = overlayByKey.get(`${p.customerId}:${p.productId}`);
    if (overlayHidesRefill(overlay, p.predictedNextDate, now)) continue;
    items.push(refillToItem(p, now));
  }

  // Filter
  let filtered = items;
  if (filter.store && filter.store !== "ALL") {
    filtered = filtered.filter((i) => i.store === filter.store);
  }
  if (filter.type && filter.type !== "ALL") {
    filtered = filtered.filter((i) => i.type === filter.type);
  }

  filtered.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  return filtered;
}

/**
 * The same merged inbox, scoped to a single customer — for the "Action needed"
 * section on their profile. Mirrors getInbox's semantics (open/due tasks + refills
 * due within the refill window, minus anything cleared/snoozed) so the rows and
 * their Done/Snooze/WhatsApp actions behave identically to the dashboard.
 */
export async function inboxForCustomer(customerId: string): Promise<InboxItem[]> {
  const now = new Date();

  const [tasks, predictions, overlays] = await Promise.all([
    prisma.task.findMany({
      where: {
        customerId,
        OR: [
          { status: "OPEN" },
          { status: "SNOOZED", snoozedUntil: { lte: now } },
        ],
      },
      include: TASK_INCLUDE,
      orderBy: { dueAt: "asc" },
    }),
    predictionsForCustomer(customerId),
    prisma.refillOverlay.findMany({ where: { customerId } }),
  ]);
  const subscribed = await activeSubscriptionKeySet();

  const overlayByKey = new Map<string, (typeof overlays)[number]>();
  for (const o of overlays) overlayByKey.set(`${o.customerId}:${o.productId}`, o);

  const items: InboxItem[] = [];
  for (const t of tasks) items.push(taskToItem(t, now));

  // predictionsForCustomer returns ALL consumables; keep only those actually due
  // (within the refill window), not managed by a subscription, and not cleared.
  for (const p of predictions) {
    if (p.daysUntilDue > REFILL_WINDOW_DAYS) continue;
    if (subscribed.has(`${p.customerId}:${p.productId}`)) continue;
    const overlay = overlayByKey.get(`${p.customerId}:${p.productId}`);
    if (overlayHidesRefill(overlay, p.predictedNextDate, now)) continue;
    items.push(refillToItem(p, now));
  }

  items.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  return items;
}

/** Small count summary for the dashboard stat cards. */
export async function inboxCounts(): Promise<{ total: number; overdue: number }> {
  const items = await getInbox();
  return {
    total: items.length,
    overdue: items.filter((i) => i.isOverdue).length,
  };
}
