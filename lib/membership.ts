// =============================================================================
// Membership spine (Phase 2).
//
// memberStatus (stored on Customer) is the field the rest of the CRM reads from;
// tier is COMPUTED here from spend (or points). This module is the single place
// to edit the rules: tier definitions, the basis they're computed on, and the
// lapse window. Status transitions and memberId assignment also live here.
// =============================================================================

import { prisma } from "./db";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// ---------------------------------------------------------------------------
// CONFIG — edit these.
// ---------------------------------------------------------------------------

// What tier is computed on. Switch in one line:
//   "lifetime"  = posSpent (POS lifetime) + local sales   ← current default
//   "rolling12" = local sales in the trailing 365 days (POS lifetime can't be
//                 windowed, so POS-only customers tier low until they buy again)
//   "points"    = stored pointsBalance
export type TierBasis = "lifetime" | "rolling12" | "points";
export const TIER_BASIS: TierBasis = "lifetime";

export interface TierDef {
  name: string;
  min: number; // ringgit spend (or points, when TIER_BASIS = "points") to reach this tier
  color: string;
}

// Must be ordered ascending by `min`. The first tier (min 0) is the floor every
// member sits in.
export const TIERS: TierDef[] = [
  { name: "Member", min: 0, color: "#94a3b8" },
  { name: "Silver", min: 1500, color: "#64748b" },
  { name: "Gold", min: 4000, color: "#f59e0b" },
];

// An ACTIVE member with no purchase in this many days lapses (→ WINBACK task).
export const LAPSED_AFTER_DAYS = 90;

const MEMBER_ID_PREFIX = "HW-";
const MEMBER_ID_PAD = 5;

// ---------------------------------------------------------------------------
// Tier computation
// ---------------------------------------------------------------------------

/** The highest tier whose threshold the value meets. */
export function computeTier(value: number): TierDef {
  let result = TIERS[0];
  for (const t of TIERS) if (value >= t.min) result = t;
  return result;
}

/** Pick the metric for the configured basis. */
export function tierMetric(m: { lifetime: number; rolling12: number; points: number }): number {
  switch (TIER_BASIS) {
    case "lifetime":
      return m.lifetime;
    case "rolling12":
      return m.rolling12;
    case "points":
      return m.points;
  }
}

// ---------------------------------------------------------------------------
// Member views — per-customer status, tier, spend, recency.
// ---------------------------------------------------------------------------

export interface MemberView {
  id: string;
  name: string | null;
  phone: string;
  memberStatus: "PROSPECT" | "ACTIVE" | "LAPSED";
  memberId: string | null;
  joinDate: Date | null;
  pointsBalance: number;
  posLoyaltyPoints: number | null;
  petCount: number;
  lifetimeSpend: number; // posSpent + local
  rolling12Spend: number; // local, trailing 365d
  lastPurchase: Date | null;
  daysSincePurchase: number | null;
  tier: TierDef;
  tierValue: number;
}

type CustomerWithSales = {
  id: string;
  name: string | null;
  phone: string;
  memberStatus: "PROSPECT" | "ACTIVE" | "LAPSED";
  memberId: string | null;
  joinDate: Date | null;
  pointsBalance: number;
  posLoyaltyPoints: number | null;
  posSpent: number | null;
  posLastPurchase: Date | null;
  pets: { id: string }[];
  transactions: { transactionDate: Date; lines: { lineTotal: number }[] }[];
};

function toMemberView(c: CustomerWithSales, now: Date): MemberView {
  const cutoff = new Date(now.getTime() - 365 * MS_PER_DAY);
  let localLifetime = 0;
  let rolling12 = 0;
  let lastLocal: Date | null = null;
  for (const t of c.transactions) {
    const sum = t.lines.reduce((s, l) => s + l.lineTotal, 0);
    localLifetime += sum;
    if (t.transactionDate >= cutoff) rolling12 += sum;
    if (!lastLocal || t.transactionDate > lastLocal) lastLocal = t.transactionDate;
  }

  // POS lifetime (pre-CRM history) + local sales (post-CRM, deduped on import so
  // they don't overlap). Edit here if your POS export already includes local sales.
  const lifetimeSpend = (c.posSpent ?? 0) + localLifetime;

  // Most recent activity across POS history and local sales.
  let lastPurchase: Date | null = lastLocal;
  if (c.posLastPurchase && (!lastPurchase || c.posLastPurchase > lastPurchase)) {
    lastPurchase = c.posLastPurchase;
  }
  const daysSincePurchase = lastPurchase
    ? Math.floor((now.getTime() - lastPurchase.getTime()) / MS_PER_DAY)
    : null;

  const tierValue = tierMetric({ lifetime: lifetimeSpend, rolling12, points: c.pointsBalance });

  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    memberStatus: c.memberStatus,
    memberId: c.memberId,
    joinDate: c.joinDate,
    pointsBalance: c.pointsBalance,
    posLoyaltyPoints: c.posLoyaltyPoints,
    petCount: c.pets.length,
    lifetimeSpend,
    rolling12Spend: rolling12,
    lastPurchase,
    daysSincePurchase,
    tier: computeTier(tierValue),
    tierValue,
  };
}

const MEMBER_SELECT = {
  id: true,
  name: true,
  phone: true,
  memberStatus: true,
  memberId: true,
  joinDate: true,
  pointsBalance: true,
  posLoyaltyPoints: true,
  posSpent: true,
  posLastPurchase: true,
  pets: { select: { id: true } },
  transactions: { select: { transactionDate: true, lines: { select: { lineTotal: true } } } },
} as const;

/** All customers as member views. */
export async function memberViews(): Promise<MemberView[]> {
  const now = new Date();
  const customers = await prisma.customer.findMany({ select: MEMBER_SELECT });
  return customers.map((c) => toMemberView(c as CustomerWithSales, now));
}

/** One customer's member view (for the profile card). */
export async function memberView(customerId: string): Promise<MemberView | null> {
  const c = await prisma.customer.findUnique({ where: { id: customerId }, select: MEMBER_SELECT });
  return c ? toMemberView(c as CustomerWithSales, new Date()) : null;
}

/** Status tile counts for the members page. */
export async function statusCounts(): Promise<{ PROSPECT: number; ACTIVE: number; LAPSED: number }> {
  const grouped = await prisma.customer.groupBy({ by: ["memberStatus"], _count: { _all: true } });
  const out = { PROSPECT: 0, ACTIVE: 0, LAPSED: 0 };
  for (const g of grouped) out[g.memberStatus as keyof typeof out] = g._count._all;
  return out;
}

// ---------------------------------------------------------------------------
// memberId assignment (HW-#####), uniqueness enforced here (no DB constraint).
// ---------------------------------------------------------------------------

export async function nextMemberId(): Promise<string> {
  const existing = await prisma.customer.findMany({
    where: { memberId: { startsWith: MEMBER_ID_PREFIX } },
    select: { memberId: true },
  });
  let max = 0;
  for (const { memberId } of existing) {
    const n = parseInt((memberId ?? "").slice(MEMBER_ID_PREFIX.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${MEMBER_ID_PREFIX}${String(max + 1).padStart(MEMBER_ID_PAD, "0")}`;
}

// ---------------------------------------------------------------------------
// Activation / claim — the membership-activation-IS-data-enrichment motion.
// ---------------------------------------------------------------------------

/**
 * Activate a customer: mark ACTIVE, record consent, stamp join/claim dates, and
 * assign a memberId. Idempotent-ish: won't reassign an existing memberId or
 * clobber an earlier joinDate.
 */
export async function claimMembership(customerId: string): Promise<void> {
  const c = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, memberId: true, joinDate: true, consentDate: true, marketingConsent: true },
  });
  if (!c) throw new Error("Customer not found.");

  const now = new Date();
  await prisma.customer.update({
    where: { id: customerId },
    data: {
      memberStatus: "ACTIVE",
      memberId: c.memberId ?? (await nextMemberId()),
      joinDate: c.joinDate ?? now,
      claimedDate: now,
      marketingConsent: true,
      consentDate: c.consentDate ?? now,
      needsDetails: false,
    },
  });
}

// ---------------------------------------------------------------------------
// Reconcile — keep stored memberStatus in step with reality. Run on inbox load
// and from the daily cron (like the hold sweep). ACTIVE→LAPSED after the lapse
// window spawns a WINBACK task; a lapsed member who buys again re-activates.
// ---------------------------------------------------------------------------

export async function reconcileMemberships(now: Date = new Date()): Promise<number> {
  // Only customers who have ever been activated can lapse / re-activate.
  const customers = await prisma.customer.findMany({
    where: { OR: [{ memberStatus: "ACTIVE" }, { memberStatus: "LAPSED" }, { claimedDate: { not: null } }] },
    select: {
      id: true,
      memberStatus: true,
      memberId: true,
      claimedDate: true,
      posLastPurchase: true,
    },
  });
  if (customers.length === 0) return 0;

  // Latest local purchase per customer in one query.
  const ids = customers.map((c) => c.id);
  const grouped = await prisma.transaction.groupBy({
    by: ["customerId"],
    where: { customerId: { in: ids } },
    _max: { transactionDate: true },
  });
  const lastLocalById = new Map<string, Date | null>();
  for (const g of grouped) if (g.customerId) lastLocalById.set(g.customerId, g._max.transactionDate);

  const lapseCutoff = new Date(now.getTime() - LAPSED_AFTER_DAYS * MS_PER_DAY);
  let changes = 0;

  for (const c of customers) {
    if (!c.claimedDate) continue; // not actually a member yet

    const lastLocal = lastLocalById.get(c.id) ?? null;
    let lastPurchase: Date | null = lastLocal;
    if (c.posLastPurchase && (!lastPurchase || c.posLastPurchase > lastPurchase)) lastPurchase = c.posLastPurchase;

    // No purchase recorded at all → treat claim date as the recency anchor.
    const anchor = lastPurchase ?? c.claimedDate;
    const desired: "ACTIVE" | "LAPSED" = anchor < lapseCutoff ? "LAPSED" : "ACTIVE";

    if (desired === c.memberStatus) {
      // Still assign a memberId if somehow missing.
      if (desired === "ACTIVE" && !c.memberId) {
        await prisma.customer.update({ where: { id: c.id }, data: { memberId: await nextMemberId() } });
        changes++;
      }
      continue;
    }

    await prisma.customer.update({
      where: { id: c.id },
      data: { memberStatus: desired, memberId: c.memberId ?? (await nextMemberId()) },
    });
    changes++;

    // On lapse, spawn a single WINBACK task (skip if one is already open).
    if (desired === "LAPSED") {
      const existing = await prisma.task.findFirst({
        where: { customerId: c.id, type: "WINBACK", status: { in: ["OPEN", "SNOOZED"] } },
        select: { id: true },
      });
      if (!existing) {
        await prisma.task.create({
          data: {
            type: "WINBACK",
            source: "SYSTEM",
            channel: "WHATSAPP",
            customerId: c.id,
            dueAt: now,
            note: `No purchase in ${LAPSED_AFTER_DAYS}+ days — reach out to win them back.`,
          },
        });
      }
    }
  }

  return changes;
}

// ---------------------------------------------------------------------------
// Backfill — give existing customers a sensible starting status. Customers with
// consent + at least one pet are treated as already-claimed (ACTIVE); everyone
// else stays PROSPECT. Idempotent: only fills blanks. Run once after the
// migration (locally via seed, on prod via the same one-off), then reconcile.
// ---------------------------------------------------------------------------

export async function backfillMemberships(): Promise<{ activated: number }> {
  const customers = await prisma.customer.findMany({
    where: { claimedDate: null },
    select: { id: true, marketingConsent: true, consentDate: true, createdAt: true, pets: { select: { id: true } } },
  });

  let activated = 0;
  for (const c of customers) {
    const claimed = c.marketingConsent && c.pets.length > 0;
    if (!claimed) continue;
    const when = c.consentDate ?? c.createdAt;
    await prisma.customer.update({
      where: { id: c.id },
      data: {
        memberStatus: "ACTIVE",
        memberId: await nextMemberId(),
        joinDate: when,
        claimedDate: when,
      },
    });
    activated++;
  }

  // Lapse any whose last purchase is already beyond the window.
  await reconcileMemberships();
  return { activated };
}
