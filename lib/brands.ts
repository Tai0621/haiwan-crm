// =============================================================================
// Supplier / consignment pipeline analytics (Phase 4).
//
// Brands are linked to products via Product.brandId (app-side join — no DB
// relation). This module rolls sell-through up by brand, computes 90-day trial
// metrics, and spawns a BRAND_REVIEW task when a trial hits day 90. Keep/drop
// decisions are thus backed by real CRM sales rather than a spreadsheet.
// =============================================================================

import { prisma } from "./db";
import { effectiveStage } from "./analytics";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
export const TRIAL_WINDOW_DAYS = 90;

export interface BrandRollup {
  units: number;
  revenue: number;
  productCount: number;
}

/** Per-brand sell-through, keyed by brandId. */
export async function brandRollups(): Promise<Map<string, BrandRollup>> {
  const products = await prisma.product.findMany({
    where: { brandId: { not: null } },
    select: { brandId: true, lines: { select: { quantity: true, lineTotal: true } } },
  });
  const map = new Map<string, BrandRollup>();
  for (const p of products) {
    const key = p.brandId!;
    const r = map.get(key) ?? { units: 0, revenue: 0, productCount: 0 };
    r.productCount++;
    for (const l of p.lines) {
      r.units += l.quantity;
      r.revenue += l.lineTotal;
    }
    map.set(key, r);
  }
  return map;
}

export interface BrandListRow {
  id: string;
  name: string;
  supplierType: string;
  status: string;
  owner: string | null;
  nextStep: string | null;
  aestheticFit: string | null;
  trialDay: number | null; // days since trialStartDate (TRIAL brands)
  rollup: BrandRollup;
}

/** All brands with their sell-through + trial-day count, for the pipeline view. */
export async function brandList(): Promise<BrandListRow[]> {
  const now = Date.now();
  const [brands, rollups] = await Promise.all([
    prisma.brand.findMany({ orderBy: [{ status: "asc" }, { name: "asc" }] }),
    brandRollups(),
  ]);
  return brands.map((b) => ({
    id: b.id,
    name: b.name,
    supplierType: b.supplierType,
    status: b.status,
    owner: b.owner,
    nextStep: b.nextStep,
    aestheticFit: b.aestheticFit,
    trialDay:
      b.status === "TRIAL" && b.trialStartDate
        ? Math.floor((now - b.trialStartDate.getTime()) / MS_PER_DAY)
        : null,
    rollup: rollups.get(b.id) ?? { units: 0, revenue: 0, productCount: 0 },
  }));
}

export interface BrandProductRow {
  id: string;
  name: string;
  sku: string;
  supplierType: string;
  units: number;
  revenue: number;
  costPrice: number | null;
  retailPrice: number | null;
  marginPct: number | null;
}

export interface TrialMetrics {
  units: number;
  revenue: number;
  buyers: number;
  repeatBuyers: number;
  repurchaseRate: number; // 0..1
  buyerProfile: Array<{ label: string; count: number }>; // species / life-stage
  basketAdjacency: Array<{ name: string; category: string; count: number }>; // co-purchased
}

export interface BrandDetail {
  brand: NonNullable<Awaited<ReturnType<typeof prisma.brand.findUnique>>>;
  trialDay: number | null;
  products: BrandProductRow[];
  metrics: TrialMetrics;
}

export async function brandDetail(brandId: string): Promise<BrandDetail | null> {
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) return null;

  const products = await prisma.product.findMany({
    where: { brandId },
    select: {
      id: true, name: true, sku: true, supplierType: true, costPrice: true, retailPrice: true,
      lines: { select: { quantity: true, lineTotal: true } },
    },
  });
  const pids = products.map((p) => p.id);

  const productRows: BrandProductRow[] = products.map((p) => {
    const units = p.lines.reduce((s, l) => s + l.quantity, 0);
    const revenue = p.lines.reduce((s, l) => s + l.lineTotal, 0);
    const marginPct =
      p.costPrice != null && p.retailPrice != null && p.retailPrice > 0
        ? Math.round(((p.retailPrice - p.costPrice) / p.retailPrice) * 100)
        : null;
    return {
      id: p.id, name: p.name, sku: p.sku, supplierType: p.supplierType,
      units, revenue, costPrice: p.costPrice, retailPrice: p.retailPrice, marginPct,
    };
  });

  const metrics = await trialMetrics(pids);
  const trialDay =
    brand.status === "TRIAL" && brand.trialStartDate
      ? Math.floor((Date.now() - brand.trialStartDate.getTime()) / MS_PER_DAY)
      : null;

  return { brand, trialDay, products: productRows, metrics };
}

/** Trial-tracker metrics for a set of product ids (a brand's catalogue). */
async function trialMetrics(productIds: string[]): Promise<TrialMetrics> {
  const empty: TrialMetrics = {
    units: 0, revenue: 0, buyers: 0, repeatBuyers: 0, repurchaseRate: 0,
    buyerProfile: [], basketAdjacency: [],
  };
  if (productIds.length === 0) return empty;

  const lines = await prisma.transactionLine.findMany({
    where: { productId: { in: productIds } },
    select: {
      quantity: true,
      lineTotal: true,
      transactionId: true,
      transaction: { select: { customerId: true } },
      pet: { select: { species: true, lifeStage: true, dateOfBirth: true, approxAgeMonths: true } },
    },
  });

  let units = 0;
  let revenue = 0;
  const txnByCustomer = new Map<string, Set<string>>(); // customerId -> distinct txns w/ brand
  const profile = new Map<string, number>();

  for (const l of lines) {
    units += l.quantity;
    revenue += l.lineTotal;
    const cid = l.transaction.customerId;
    if (cid) {
      if (!txnByCustomer.has(cid)) txnByCustomer.set(cid, new Set());
      txnByCustomer.get(cid)!.add(l.transactionId);
    }
    if (l.pet) {
      const stage = effectiveStage(l.pet);
      const label = `${l.pet.species} · ${stage}`;
      profile.set(label, (profile.get(label) ?? 0) + 1);
    }
  }

  const buyers = txnByCustomer.size;
  let repeatBuyers = 0;
  for (const txns of txnByCustomer.values()) if (txns.size >= 2) repeatBuyers++;

  // Basket adjacency: other products bought in the same transactions.
  const txnIds = Array.from(new Set(lines.map((l) => l.transactionId)));
  const others = await prisma.transactionLine.findMany({
    where: { transactionId: { in: txnIds }, productId: { notIn: productIds, not: null } },
    select: { quantity: true, product: { select: { name: true, category: true } } },
  });
  const adj = new Map<string, { name: string; category: string; count: number }>();
  for (const o of others) {
    if (!o.product) continue;
    const key = o.product.name;
    const e = adj.get(key) ?? { name: o.product.name, category: o.product.category, count: 0 };
    e.count += o.quantity;
    adj.set(key, e);
  }

  return {
    units,
    revenue,
    buyers,
    repeatBuyers,
    repurchaseRate: buyers > 0 ? repeatBuyers / buyers : 0,
    buyerProfile: Array.from(profile.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
    basketAdjacency: Array.from(adj.values()).sort((a, b) => b.count - a.count).slice(0, 8),
  };
}

// ---------------------------------------------------------------------------
// Reconcile — spawn a BRAND_REVIEW task when a TRIAL brand reaches day 90. Run
// on dashboard load + the eod cron (like the other reconciles). Idempotent.
// ---------------------------------------------------------------------------
export async function reconcileBrandTrials(now: Date = new Date()): Promise<number> {
  const trials = await prisma.brand.findMany({
    where: { status: "TRIAL", trialStartDate: { not: null } },
    select: { id: true, name: true, trialStartDate: true },
  });

  let created = 0;
  for (const b of trials) {
    const days = Math.floor((now.getTime() - b.trialStartDate!.getTime()) / MS_PER_DAY);
    if (days < TRIAL_WINDOW_DAYS) continue;

    const existing = await prisma.task.findFirst({
      where: { brandId: b.id, type: "BRAND_REVIEW", status: { in: ["OPEN", "SNOOZED"] } },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.task.create({
      data: {
        type: "BRAND_REVIEW",
        source: "SYSTEM",
        channel: "SYSTEM",
        brandId: b.id,
        dueAt: now,
        note: `90-day trial review for ${b.name} — keep, drop, or move toward co-creation, backed by sell-through.`,
      },
    });
    created++;
  }
  return created;
}
