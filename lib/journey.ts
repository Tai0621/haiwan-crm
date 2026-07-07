// =============================================================================
// Customer journey — lifestyle segments, purchase heatmap, and recommendations.
//
// The 19 free-text product categories roll up into five journey segments
// (Home & Rest, Walk & Travel, Skin & Grooming, Toys & Accessories,
// Nutrition & Health) so a customer's buying pattern reads as a story, not a
// category list. The heatmap shows WHAT they buy (rows) and WHEN (last 12
// months); recommendations are rule-based v1: fill journey gaps with the
// store's proven sellers, filtered to the customer's pets (species + life
// stage), never suggesting something they already bought.
// =============================================================================

import { prisma } from "./db";
import { monthKeyMYT } from "./format";
import { effectiveStage } from "./analytics";

export const JOURNEY_SEGMENTS = [
  { id: "HOME_REST", label: "Home & Rest", color: "#3b82f6" },
  { id: "WALK_TRAVEL", label: "Walk & Travel", color: "#10b981" },
  { id: "GROOMING", label: "Skin & Grooming", color: "#eab308" },
  { id: "TOYS_ACCESSORIES", label: "Toys & Accessories", color: "#f97316" },
  { id: "NUTRITION_HEALTH", label: "Nutrition & Health", color: "#ef4444" },
  { id: "OTHER", label: "Other", color: "#94a3b8" },
] as const;

export type SegmentId = (typeof JOURNEY_SEGMENTS)[number]["id"];

// Free-text Product.category → journey segment. Anything unmapped lands in
// OTHER. ELYAND is a brand-named apparel/accessory category from StoreHub.
const CATEGORY_SEGMENT: Record<string, SegmentId> = {
  "BEDS / NEST": "HOME_REST",
  "CAT TREE / SCRATCHER": "HOME_REST",
  "LITTER BOX": "HOME_REST",
  "BOWLS / FEEDER MATS": "HOME_REST",
  COLLARS: "WALK_TRAVEL",
  HARNESS: "WALK_TRAVEL",
  LEASH: "WALK_TRAVEL",
  TRAVEL: "WALK_TRAVEL",
  TAGS: "WALK_TRAVEL",
  "POOP BAG HOLDER": "WALK_TRAVEL",
  GROOM: "GROOMING",
  "SURGERY CONE": "GROOMING",
  TOYS: "TOYS_ACCESSORIES",
  CLOTHES: "TOYS_ACCESSORIES",
  ELYAND: "TOYS_ACCESSORIES",
  FOOD: "NUTRITION_HEALTH",
  TREATS: "NUTRITION_HEALTH",
  LITTER: "NUTRITION_HEALTH", // consumable litter (LITTER BOX hardware = Home)
  SUPPLEMENT: "NUTRITION_HEALTH",
  // Singular/legacy aliases (local seed + older imports use lowercase singulars).
  TREAT: "NUTRITION_HEALTH",
  BED: "HOME_REST",
  TOY: "TOYS_ACCESSORIES",
  ACCESSORY: "TOYS_ACCESSORIES",
  COLLAR: "WALK_TRAVEL",
};

export function segmentForCategory(category: string | null | undefined): SegmentId {
  if (!category) return "OTHER";
  return CATEGORY_SEGMENT[category.trim().toUpperCase()] ?? "OTHER";
}

/** Categories belonging to a segment (for recommendation queries). */
const categoriesForSegment = (id: SegmentId): string[] =>
  Object.entries(CATEGORY_SEGMENT)
    .filter(([, seg]) => seg === id)
    .map(([cat]) => cat);

// ---------------------------------------------------------------------------
// Heatmap data
// ---------------------------------------------------------------------------

export interface JourneySegmentRow {
  id: SegmentId;
  label: string;
  color: string;
  monthUnits: number[]; // aligned with JourneyProfile.months
  units: number; // lifetime units (not just the window)
  spend: number; // lifetime spend
  lastAt: Date | null;
}

export interface JourneyProfile {
  months: string[]; // last 12 month keys (MYT), oldest first
  rows: JourneySegmentRow[]; // one per segment, OTHER omitted when empty
  maxCell: number; // for color scaling
  totalUnits: number;
}

const MONTHS_WINDOW = 12;

function lastMonthKeys(now: Date): string[] {
  // Month arithmetic in MYT: shift the instant by +8h so UTC getters read MYT.
  const myt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const keys: string[] = [];
  let y = myt.getUTCFullYear();
  let m = myt.getUTCMonth(); // 0-based
  for (let i = 0; i < MONTHS_WINDOW; i++) {
    keys.unshift(`${y}-${String(m + 1).padStart(2, "0")}`);
    m--;
    if (m < 0) { m = 11; y--; }
  }
  return keys;
}

export async function journeyForCustomer(
  customerId: string,
  now: Date = new Date(),
): Promise<JourneyProfile> {
  const lines = await prisma.transactionLine.findMany({
    where: { transaction: { customerId } },
    select: {
      quantity: true,
      lineTotal: true,
      product: { select: { category: true } },
      transaction: { select: { transactionDate: true } },
    },
  });

  const months = lastMonthKeys(now);
  const monthIndex = new Map(months.map((k, i) => [k, i]));

  const rows: JourneySegmentRow[] = JOURNEY_SEGMENTS.map((s) => ({
    ...s,
    monthUnits: months.map(() => 0),
    units: 0,
    spend: 0,
    lastAt: null,
  }));
  const byId = new Map(rows.map((r) => [r.id, r]));

  for (const l of lines) {
    const row = byId.get(segmentForCategory(l.product?.category))!;
    const units = Math.max(1, Math.round(l.quantity)); // count a line as ≥1 purchase
    row.units += units;
    row.spend += l.lineTotal;
    const at = l.transaction.transactionDate;
    if (!row.lastAt || at > row.lastAt) row.lastAt = at;
    const idx = monthIndex.get(monthKeyMYT(at));
    if (idx !== undefined) row.monthUnits[idx] += units;
  }

  const visible = rows.filter((r) => r.id !== "OTHER" || r.units > 0);
  const maxCell = Math.max(1, ...visible.flatMap((r) => r.monthUnits));
  const totalUnits = visible.reduce((s, r) => s + r.units, 0);
  return { months, rows: visible, maxCell, totalUnits };
}

// ---------------------------------------------------------------------------
// Recommendations (rule-based v1)
// ---------------------------------------------------------------------------

export interface Recommendation {
  segmentId: SegmentId;
  segmentLabel: string;
  segmentColor: string;
  reason: string;
  products: Array<{ id: string; name: string; retailPrice: number | null }>;
}

const MAX_GAP_SEGMENTS = 3;
const PRODUCTS_PER_SEGMENT = 2;

export async function recommendationsForCustomer(
  customerId: string,
  profile: JourneyProfile,
): Promise<Recommendation[]> {
  // Nothing bought yet → no behaviour to recommend from.
  if (profile.totalUnits === 0) return [];

  const [pets, boughtLines] = await Promise.all([
    prisma.pet.findMany({
      where: { customerId },
      select: { species: true, lifeStage: true, dateOfBirth: true, approxAgeMonths: true },
    }),
    prisma.transactionLine.findMany({
      where: { transaction: { customerId }, productId: { not: null } },
      select: { productId: true },
    }),
  ]);
  const boughtIds = [...new Set(boughtLines.map((l) => l.productId as string))];

  // Species filter: a DOG household sees DOG+ANY products, etc. No pets (or
  // OTHER species) → don't filter by species.
  const speciesSet = new Set(pets.map((p) => p.species));
  const targetSpecies: ("DOG" | "CAT" | "ANY")[] | null =
    speciesSet.size > 0 && !speciesSet.has("OTHER")
      ? [...(speciesSet as Set<"DOG" | "CAT">), "ANY"]
      : null;

  // Life-stage filter: only when every pet's stage is known.
  const stages = pets.map((p) => effectiveStage(p));
  const lifeStages: ("PUPPY_KITTEN" | "ADULT" | "SENIOR" | "ANY")[] | null =
    stages.length > 0 && !stages.includes("UNKNOWN")
      ? [...new Set(stages as ("PUPPY_KITTEN" | "ADULT" | "SENIOR")[]), "ANY"]
      : null;

  // Journey gaps: segments they've never bought from. Nutrition & Health jumps
  // the queue — a consumables gap is the one that turns into repeat purchases
  // (refills → subscriptions); the rest keep the natural journey order.
  const gaps = profile.rows
    .filter((r) => r.id !== "OTHER" && r.units === 0)
    .sort((a, b) => (a.id === "NUTRITION_HEALTH" ? -1 : 0) - (b.id === "NUTRITION_HEALTH" ? -1 : 0))
    .slice(0, MAX_GAP_SEGMENTS);

  const recs: Recommendation[] = [];
  for (const gap of gaps) {
    const products = await prisma.product.findMany({
      where: {
        category: { in: categoriesForSegment(gap.id) },
        id: { notIn: boughtIds },
        retailPrice: { not: null },
        ...(targetSpecies ? { targetSpecies: { in: targetSpecies } } : {}),
        ...(lifeStages ? { lifeStage: { in: lifeStages } } : {}),
      },
      orderBy: { lines: { _count: "desc" } }, // proven sellers across all customers
      take: PRODUCTS_PER_SEGMENT,
      select: { id: true, name: true, retailPrice: true, _count: { select: { lines: true } } },
    });
    const proven = products.filter((p) => p._count.lines > 0);
    if (proven.length === 0) continue;
    recs.push({
      segmentId: gap.id,
      segmentLabel: gap.label,
      segmentColor: gap.color,
      reason: `Hasn't bought ${gap.label} yet — popular picks for their pets`,
      products: proven.map((p) => ({ id: p.id, name: p.name, retailPrice: p.retailPrice })),
    });
  }
  return recs;
}
