// =============================================================================
// Empirical refill prediction.
//
// We DO NOT model biological consumption (calories/weight). Instead we predict
// the next purchase purely from the customer's actual repurchase intervals for
// each consumable product.
//
// For each (customer, consumable product):
//   • >= 2 purchases:  avgGapDays = mean of day-gaps between consecutive
//                      purchases;  predictedNextDate = lastPurchase + avgGap.
//   • exactly 1:       predictedNextDate = lastPurchase + categoryDefaultDays.
//   • A refill is "due soon" if predictedNextDate is within REFILL_WINDOW_DAYS.
//
// Predictions are computed on the fly (never stored), so they always reflect
// the latest transaction data.
// =============================================================================

import { prisma } from "./db";
import { REFILL_WINDOW_DAYS, categoryDefaultDays } from "./constants";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export interface RefillPrediction {
  customerId: string;
  customerName: string | null;
  customerPhone: string;
  productId: string;
  productName: string;
  productCategory: string;
  // Pets this customer has that the purchases were attributed to (may be empty)
  petNames: string[];
  purchaseCount: number;
  lastPurchaseDate: Date;
  avgGapDays: number | null; // null when only 1 purchase (used category default)
  predictedNextDate: Date;
  daysUntilDue: number; // negative = overdue
  basis: "interval" | "category-default";
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

/**
 * Collapse a list of purchase timestamps into DISTINCT purchase occasions.
 * Multiple line-items of the same product on the same day (e.g. one bag per
 * pet on a single receipt) count as ONE purchase occasion — otherwise the
 * zero-day gaps between them deflate the average interval and predict refills
 * far too early. Returns unique calendar days, sorted ascending.
 */
function distinctPurchaseDays(dates: Date[]): Date[] {
  const byDay = new Map<string, Date>();
  for (const d of dates) {
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!byDay.has(key)) byDay.set(key, d);
  }
  return Array.from(byDay.values()).sort((a, b) => a.getTime() - b.getTime());
}

/**
 * The empirical prediction itself. Given distinct purchase days (ascending)
 * and the product category, returns the predicted next purchase date plus the
 * average gap (null when only one purchase) and which basis was used.
 *   >= 2 days : predictedNext = lastDay + mean(consecutive day-gaps)
 *   exactly 1 : predictedNext = lastDay + categoryDefaultDays
 */
function computePrediction(
  days: Date[],
  category: string,
): { predictedNextDate: Date; avgGapDays: number | null; basis: "interval" | "category-default" } {
  const lastPurchaseDate = days[days.length - 1];
  if (days.length >= 2) {
    let totalGap = 0;
    for (let i = 1; i < days.length; i++) totalGap += daysBetween(days[i - 1], days[i]);
    const avgGapDays = totalGap / (days.length - 1);
    return {
      predictedNextDate: new Date(lastPurchaseDate.getTime() + avgGapDays * MS_PER_DAY),
      avgGapDays,
      basis: "interval",
    };
  }
  const defDays = categoryDefaultDays(category);
  return {
    predictedNextDate: new Date(lastPurchaseDate.getTime() + defDays * MS_PER_DAY),
    avgGapDays: null,
    basis: "category-default",
  };
}

/**
 * Compute refill predictions for a single PET — i.e. consumables purchased
 * specifically for this pet (TransactionLine.petId == petId). This is the
 * pet-centric view: "Mochi's food is due in 3 days".
 */
export async function predictionsForPet(petId: string): Promise<RefillPrediction[]> {
  const pet = await prisma.pet.findUnique({
    where: { id: petId },
    select: { id: true, name: true, customer: { select: { id: true, name: true, phone: true } } },
  });
  if (!pet) return [];

  const lines = await prisma.transactionLine.findMany({
    where: { petId, product: { isConsumable: true } },
    select: {
      product: { select: { id: true, name: true, category: true } },
      transaction: { select: { transactionDate: true } },
    },
  });

  const byProduct = new Map<string, { name: string; category: string; dates: Date[] }>();
  for (const line of lines) {
    if (!line.product) continue;
    const key = line.product.id;
    if (!byProduct.has(key)) {
      byProduct.set(key, { name: line.product.name, category: line.product.category, dates: [] });
    }
    byProduct.get(key)!.dates.push(line.transaction.transactionDate);
  }

  const now = new Date();
  const results: RefillPrediction[] = [];
  for (const [productId, data] of byProduct) {
    const days = distinctPurchaseDays(data.dates);
    const lastPurchaseDate = days[days.length - 1];
    const { predictedNextDate, avgGapDays, basis } = computePrediction(days, data.category);
    results.push({
      customerId: pet.customer.id,
      customerName: pet.customer.name,
      customerPhone: pet.customer.phone,
      productId,
      productName: data.name,
      productCategory: data.category,
      petNames: [pet.name],
      purchaseCount: days.length,
      lastPurchaseDate,
      avgGapDays,
      predictedNextDate,
      daysUntilDue: daysBetween(now, predictedNextDate),
      basis,
    });
  }
  results.sort((a, b) => a.predictedNextDate.getTime() - b.predictedNextDate.getTime());
  return results;
}

/**
 * Compute refill predictions for a single customer across all consumable
 * products they have ever purchased.
 */
export async function predictionsForCustomer(customerId: string): Promise<RefillPrediction[]> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, name: true, phone: true },
  });
  if (!customer) return [];

  // All line items for this customer's transactions, where the product is a
  // known consumable. Include pet + product + transaction date.
  const lines = await prisma.transactionLine.findMany({
    where: {
      transaction: { customerId },
      product: { isConsumable: true },
    },
    select: {
      quantity: true,
      product: { select: { id: true, name: true, category: true } },
      pet: { select: { name: true } },
      transaction: { select: { transactionDate: true } },
    },
  });

  // Group by product
  const byProduct = new Map<
    string,
    {
      productName: string;
      category: string;
      dates: Date[];
      petNames: Set<string>;
    }
  >();

  for (const line of lines) {
    if (!line.product) continue;
    const key = line.product.id;
    if (!byProduct.has(key)) {
      byProduct.set(key, {
        productName: line.product.name,
        category: line.product.category,
        dates: [],
        petNames: new Set(),
      });
    }
    const entry = byProduct.get(key)!;
    entry.dates.push(line.transaction.transactionDate);
    if (line.pet?.name) entry.petNames.add(line.pet.name);
  }

  const now = new Date();
  const results: RefillPrediction[] = [];

  for (const [productId, data] of byProduct) {
    const days = distinctPurchaseDays(data.dates);
    const lastPurchaseDate = days[days.length - 1];
    const { predictedNextDate, avgGapDays, basis } = computePrediction(days, data.category);
    const daysUntilDue = daysBetween(now, predictedNextDate);

    results.push({
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      productId,
      productName: data.productName,
      productCategory: data.category,
      petNames: Array.from(data.petNames),
      purchaseCount: days.length,
      lastPurchaseDate,
      avgGapDays,
      predictedNextDate,
      daysUntilDue,
      basis,
    });
  }

  // Soonest due first
  results.sort((a, b) => a.predictedNextDate.getTime() - b.predictedNextDate.getTime());
  return results;
}

/**
 * The "To contact this week" list: every consumable, across all customers,
 * predicted to run out within REFILL_WINDOW_DAYS. Sorted soonest-first.
 */
export async function dueSoonPredictions(
  windowDays: number = REFILL_WINDOW_DAYS,
): Promise<RefillPrediction[]> {
  // Only consider customers that exist (matched). Pull line items for all
  // consumable products belonging to matched transactions.
  const lines = await prisma.transactionLine.findMany({
    where: {
      transaction: { customerId: { not: null } },
      product: { isConsumable: true },
    },
    select: {
      product: { select: { id: true, name: true, category: true } },
      pet: { select: { name: true } },
      transaction: {
        select: {
          transactionDate: true,
          customerId: true,
          customer: { select: { id: true, name: true, phone: true } },
        },
      },
    },
  });

  // Group by customer+product
  type Group = {
    customerId: string;
    customerName: string | null;
    customerPhone: string;
    productId: string;
    productName: string;
    category: string;
    dates: Date[];
    petNames: Set<string>;
  };
  const groups = new Map<string, Group>();

  for (const line of lines) {
    const c = line.transaction.customer;
    if (!c || !line.product) continue;
    const key = `${c.id}::${line.product.id}`;
    if (!groups.has(key)) {
      groups.set(key, {
        customerId: c.id,
        customerName: c.name,
        customerPhone: c.phone,
        productId: line.product.id,
        productName: line.product.name,
        category: line.product.category,
        dates: [],
        petNames: new Set(),
      });
    }
    const g = groups.get(key)!;
    g.dates.push(line.transaction.transactionDate);
    if (line.pet?.name) g.petNames.add(line.pet.name);
  }

  const now = new Date();
  const out: RefillPrediction[] = [];

  for (const g of groups.values()) {
    const days = distinctPurchaseDays(g.dates);
    const lastPurchaseDate = days[days.length - 1];
    const { predictedNextDate, avgGapDays, basis } = computePrediction(days, g.category);
    const daysUntilDue = daysBetween(now, predictedNextDate);

    if (daysUntilDue <= windowDays) {
      out.push({
        customerId: g.customerId,
        customerName: g.customerName,
        customerPhone: g.customerPhone,
        productId: g.productId,
        productName: g.productName,
        productCategory: g.category,
        petNames: Array.from(g.petNames),
        purchaseCount: days.length,
        lastPurchaseDate,
        avgGapDays,
        predictedNextDate,
        daysUntilDue,
        basis,
      });
    }
  }

  out.sort((a, b) => a.predictedNextDate.getTime() - b.predictedNextDate.getTime());
  return out;
}
