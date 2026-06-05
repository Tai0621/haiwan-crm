// =============================================================================
// Shared analytics helpers: margin mix, RFM, revenue mix.
// All computed on the fly from TransactionLines joined to Products.
// Lines with no matched product fall into the "UNCLASSIFIED" bucket.
// =============================================================================

import { prisma } from "./db";

export type SupplierBucket = "INHOUSE" | "CONSIGNMENT" | "TRADING" | "UNCLASSIFIED";

export interface MarginMix {
  INHOUSE: number;
  CONSIGNMENT: number;
  TRADING: number;
  UNCLASSIFIED: number;
  total: number;
}

function emptyMix(): MarginMix {
  return { INHOUSE: 0, CONSIGNMENT: 0, TRADING: 0, UNCLASSIFIED: 0, total: 0 };
}

/** Margin mix (spend by supplierType) for a single customer. */
export async function marginMixForCustomer(customerId: string): Promise<MarginMix> {
  const lines = await prisma.transactionLine.findMany({
    where: { transaction: { customerId } },
    select: { lineTotal: true, product: { select: { supplierType: true } } },
  });
  const mix = emptyMix();
  for (const l of lines) {
    const bucket: SupplierBucket = l.product?.supplierType ?? "UNCLASSIFIED";
    mix[bucket] += l.lineTotal;
    mix.total += l.lineTotal;
  }
  return mix;
}

// ---------------------------------------------------------------------------
// Pet-level analytics — everything attributed to one pet (TransactionLine.petId)
// ---------------------------------------------------------------------------
export interface PetAnalytics {
  totalSpend: number;
  lineCount: number;
  distinctVisits: number; // distinct transactions this pet appears on
  firstPurchase: Date | null;
  lastPurchase: Date | null;
  mix: MarginMix;
  categorySpend: Array<{ category: string; amount: number }>;
  topProducts: Array<{ productId: string | null; name: string; qty: number; spend: number; supplierType: string | null }>;
}

export async function petAnalytics(petId: string): Promise<PetAnalytics> {
  const lines = await prisma.transactionLine.findMany({
    where: { petId },
    select: {
      transactionId: true,
      quantity: true,
      lineTotal: true,
      rawProductName: true,
      product: { select: { id: true, name: true, category: true, supplierType: true } },
      transaction: { select: { transactionDate: true } },
    },
  });

  const mix = emptyMix();
  const byCategory = new Map<string, number>();
  const byProduct = new Map<
    string,
    { productId: string | null; name: string; qty: number; spend: number; supplierType: string | null }
  >();
  const visitIds = new Set<string>();
  let firstPurchase: Date | null = null;
  let lastPurchase: Date | null = null;
  let totalSpend = 0;

  for (const l of lines) {
    totalSpend += l.lineTotal;
    visitIds.add(l.transactionId);

    const bucket: SupplierBucket = l.product?.supplierType ?? "UNCLASSIFIED";
    mix[bucket] += l.lineTotal;
    mix.total += l.lineTotal;

    const cat = l.product?.category ?? "unclassified";
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + l.lineTotal);

    const name = l.product?.name ?? l.rawProductName;
    const key = l.product?.id ?? `raw:${name}`;
    const entry = byProduct.get(key) ?? {
      productId: l.product?.id ?? null,
      name,
      qty: 0,
      spend: 0,
      supplierType: l.product?.supplierType ?? null,
    };
    entry.qty += l.quantity;
    entry.spend += l.lineTotal;
    byProduct.set(key, entry);

    const d = l.transaction.transactionDate;
    if (!firstPurchase || d < firstPurchase) firstPurchase = d;
    if (!lastPurchase || d > lastPurchase) lastPurchase = d;
  }

  return {
    totalSpend,
    lineCount: lines.length,
    distinctVisits: visitIds.size,
    firstPurchase,
    lastPurchase,
    mix,
    categorySpend: Array.from(byCategory.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
    topProducts: Array.from(byProduct.values()).sort((a, b) => b.spend - a.spend),
  };
}

/** Percentage helper. */
export function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

/** Margin mix per customer (for the segment table). */
export interface CustomerMarginRow {
  customerId: string;
  name: string | null;
  phone: string;
  mix: MarginMix;
  tradingPct: number;
  inhousePct: number;
}

export async function marginMixAllCustomers(): Promise<CustomerMarginRow[]> {
  const customers = await prisma.customer.findMany({
    select: {
      id: true,
      name: true,
      phone: true,
      transactions: {
        select: {
          lines: { select: { lineTotal: true, product: { select: { supplierType: true } } } },
        },
      },
    },
  });

  const rows: CustomerMarginRow[] = customers.map((c) => {
    const mix = emptyMix();
    for (const t of c.transactions) {
      for (const l of t.lines) {
        const bucket: SupplierBucket = l.product?.supplierType ?? "UNCLASSIFIED";
        mix[bucket] += l.lineTotal;
        mix.total += l.lineTotal;
      }
    }
    return {
      customerId: c.id,
      name: c.name,
      phone: c.phone,
      mix,
      tradingPct: pct(mix.TRADING, mix.total),
      inhousePct: pct(mix.INHOUSE, mix.total),
    };
  });

  // Only customers with spend; sort by trading-share desc (best convert targets)
  return rows
    .filter((r) => r.mix.total > 0)
    .sort((a, b) => b.tradingPct - a.tradingPct);
}

// ---------------------------------------------------------------------------
// Lifecycle segmentation (pet-centric)
//   • "new pet parent" = customer whose YOUNGEST pet is a puppy/kitten — high LTV
//   • "senior owner"   = customer with at least one senior pet — joint/senior cross-sell
// ---------------------------------------------------------------------------

export type EffectiveStage = "PUPPY_KITTEN" | "ADULT" | "SENIOR" | "UNKNOWN";

/**
 * Determine a pet's life stage. Manual lifeStage wins; otherwise derive from
 * DOB or approxAgeMonths (< 12 mo = puppy/kitten, >= 96 mo / 8 yr = senior).
 */
export function effectiveStage(pet: {
  lifeStage: string | null;
  dateOfBirth: Date | null;
  approxAgeMonths: number | null;
}): EffectiveStage {
  if (pet.lifeStage) return pet.lifeStage as EffectiveStage;
  let months: number | null = pet.approxAgeMonths;
  if (months == null && pet.dateOfBirth) {
    months = Math.floor((Date.now() - pet.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
  }
  if (months == null) return "UNKNOWN";
  if (months < 12) return "PUPPY_KITTEN";
  if (months >= 96) return "SENIOR";
  return "ADULT";
}

export interface LifecycleRow {
  customerId: string;
  name: string | null;
  phone: string;
  pets: Array<{ name: string; species: string; stage: EffectiveStage; ageMonths: number | null }>;
  youngestStage: EffectiveStage;
  isNewPetParent: boolean; // youngest pet is puppy/kitten
  hasSenior: boolean;
}

export async function lifecycleSegments(): Promise<LifecycleRow[]> {
  const customers = await prisma.customer.findMany({
    where: { pets: { some: {} } },
    select: {
      id: true,
      name: true,
      phone: true,
      pets: {
        select: { name: true, species: true, lifeStage: true, dateOfBirth: true, approxAgeMonths: true },
      },
    },
  });

  return customers.map((c) => {
    const pets = c.pets.map((p) => {
      let months: number | null = p.approxAgeMonths;
      if (months == null && p.dateOfBirth) {
        months = Math.floor((Date.now() - p.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
      }
      return { name: p.name, species: p.species, stage: effectiveStage(p), ageMonths: months };
    });

    // Youngest = smallest known age in months; pets with unknown age sort last.
    const withAge = pets.filter((p) => p.ageMonths != null);
    const youngest =
      withAge.length > 0
        ? withAge.reduce((a, b) => (a.ageMonths! <= b.ageMonths! ? a : b))
        : pets[0];

    return {
      customerId: c.id,
      name: c.name,
      phone: c.phone,
      pets,
      youngestStage: youngest?.stage ?? "UNKNOWN",
      isNewPetParent: youngest?.stage === "PUPPY_KITTEN",
      hasSenior: pets.some((p) => p.stage === "SENIOR"),
    };
  });
}

// ---------------------------------------------------------------------------
// Product analysis — consignment & trading products by sales volume and price.
// Used to spot which third-party SKUs are worth building in-house: high volume
// and/or high revenue means proven demand we currently buy in.
// ---------------------------------------------------------------------------
export interface ProductAnalysisRow {
  productId: string;
  sku: string;
  name: string;
  brand: string | null;
  category: string;
  supplierType: "CONSIGNMENT" | "TRADING";
  unitsSold: number; // total quantity sold across all lines
  revenue: number; // total lineTotal
  avgSellingPrice: number; // revenue / unitsSold (0 when nothing sold)
  retailPrice: number | null;
  costPrice: number | null;
  marginPct: number | null; // (retail - cost) / retail, when both known
}

export async function productAnalysis(): Promise<ProductAnalysisRow[]> {
  const products = await prisma.product.findMany({
    where: { supplierType: { in: ["CONSIGNMENT", "TRADING"] } },
    select: {
      id: true,
      sku: true,
      name: true,
      brand: true,
      category: true,
      supplierType: true,
      retailPrice: true,
      costPrice: true,
      lines: { select: { quantity: true, lineTotal: true } },
    },
  });

  const rows: ProductAnalysisRow[] = products.map((p) => {
    const unitsSold = p.lines.reduce((s, l) => s + l.quantity, 0);
    const revenue = p.lines.reduce((s, l) => s + l.lineTotal, 0);
    const avgSellingPrice = unitsSold > 0 ? revenue / unitsSold : 0;
    const marginPct =
      p.costPrice != null && p.retailPrice != null && p.retailPrice > 0
        ? Math.round(((p.retailPrice - p.costPrice) / p.retailPrice) * 100)
        : null;
    return {
      productId: p.id,
      sku: p.sku,
      name: p.name,
      brand: p.brand,
      category: p.category,
      supplierType: p.supplierType as "CONSIGNMENT" | "TRADING",
      unitsSold,
      revenue,
      avgSellingPrice,
      retailPrice: p.retailPrice,
      costPrice: p.costPrice,
      marginPct,
    };
  });

  // Highest proven demand first — the strongest build-in-house candidates.
  return rows.sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue);
}

// ---------------------------------------------------------------------------
// Revenue mix — monthly revenue split by supplierType (the north-star chart)
// ---------------------------------------------------------------------------
export interface MonthlyRevenueRow {
  month: string; // "YYYY-MM"
  INHOUSE: number;
  CONSIGNMENT: number;
  TRADING: number;
  UNCLASSIFIED: number;
}

export async function monthlyRevenueMix(): Promise<MonthlyRevenueRow[]> {
  const lines = await prisma.transactionLine.findMany({
    select: {
      lineTotal: true,
      product: { select: { supplierType: true } },
      transaction: { select: { transactionDate: true } },
    },
  });

  const byMonth = new Map<string, MonthlyRevenueRow>();
  for (const l of lines) {
    const d = l.transaction.transactionDate;
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth.has(month)) {
      byMonth.set(month, { month, INHOUSE: 0, CONSIGNMENT: 0, TRADING: 0, UNCLASSIFIED: 0 });
    }
    const row = byMonth.get(month)!;
    const bucket: SupplierBucket = l.product?.supplierType ?? "UNCLASSIFIED";
    row[bucket] += l.lineTotal;
  }

  return Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month));
}
