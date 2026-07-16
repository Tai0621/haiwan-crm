// =============================================================================
// Partner breakeven — the "can this vendor make money?" KPI.
//
// Mirrors the Haiwan "Vendor Breakeven Model" workbook. An online partner pays
// ongoing program fees (a monthly listing fee + committed ad spend, in their own
// currency). Haiwan takes a commission on RRP, and the vendor's own COGS is a
// share of RRP set by their markup (COGS% = 1/markup). So each RM1 of RRP the
// partner sells returns them:
//
//     net per RM1 RRP = (1 - commission%) - COGS%
//
// The partner only starts making money once monthly RRP sales clear their fees:
//
//     breakeven RRP sales / mth = monthly fees (RM) / net per RM1 RRP
//
// We then compare that breakeven to the partner's ACTUAL monthly sell-through
// (from real CRM sales) to flag whether they're above water or bleeding on fees.
// =============================================================================

import { prisma } from "./db";

const DAYS_PER_MONTH = 30.4; // matches the workbook

export interface BreakevenAssumptions {
  fxUsdMyr: number;
  fxSgdMyr: number;
  defaultMarkup: number;
}

export const DEFAULT_ASSUMPTIONS: BreakevenAssumptions = {
  fxUsdMyr: 4.08,
  fxSgdMyr: 3.16,
  defaultMarkup: 3,
};

/** Load the editable FX + markup assumptions (falls back to workbook defaults). */
export async function getAssumptions(): Promise<BreakevenAssumptions> {
  const s = await prisma.appSetting.findUnique({ where: { id: "default" } });
  return {
    fxUsdMyr: s?.fxUsdMyr ?? DEFAULT_ASSUMPTIONS.fxUsdMyr,
    fxSgdMyr: s?.fxSgdMyr ?? DEFAULT_ASSUMPTIONS.fxSgdMyr,
    defaultMarkup: s?.defaultVendorMarkup ?? DEFAULT_ASSUMPTIONS.defaultMarkup,
  };
}

export function fxToMyr(ccy: string | null | undefined, a: BreakevenAssumptions): number {
  switch ((ccy ?? "MYR").toUpperCase()) {
    case "USD": return a.fxUsdMyr;
    case "SGD": return a.fxSgdMyr;
    default: return 1;
  }
}

export type BreakevenStatus =
  | "PROFITABLE"  // actual monthly RRP sales >= breakeven
  | "BELOW"       // selling, but under breakeven — losing money on fees
  | "UNVIABLE"    // net contribution <= 0 — can't break even at any volume
  | "NO_FEES"     // no program fees recorded — nothing to clear
  | "NO_DATA";    // fees set but no sales yet to judge against

export interface BreakevenInput {
  feeCurrency: string | null;
  listingFeeMonthly: number | null;
  adSpendMonthly: number | null;
  commissionPct: number | null; // e.g. 30 for 30%
  vendorMarkup: number | null;  // null => assumptions.defaultMarkup
  avgRrp: number | null;        // RM per unit (sales-weighted where possible)
  actualMonthlyRrp: number | null; // actual RRP sales run-rate, RM/mth (null = no sales)
}

export interface BreakevenResult {
  fx: number;
  markup: number;
  commissionPct: number;         // resolved %, e.g. 30
  cogsPct: number;               // 0..1
  netPerRm1: number;             // vendor net contribution per RM1 RRP
  totalVendorCostMyr: number;    // monthly fees in RM
  breakevenRrpMonthly: number | null;
  breakevenUnitsMonthly: number | null;
  breakevenUnitsDay: number | null;
  breakeven3MonthTrial: number | null;
  actualMonthlyRrp: number | null;
  surplusMonthly: number | null; // actual - breakeven (negative = shortfall)
  coverage: number | null;       // actual / breakeven (1.0 = exactly breakeven)
  status: BreakevenStatus;
  sensitivity: Array<{ markup: number; breakevenRrpMonthly: number | null }>;
}

const MARKUP_SCENARIOS = [2, 2.5, 3, 4, 5];

/** Pure breakeven math — same formulas as the workbook. */
export function computeBreakeven(input: BreakevenInput, a: BreakevenAssumptions): BreakevenResult {
  const markup = input.vendorMarkup && input.vendorMarkup > 0 ? input.vendorMarkup : a.defaultMarkup;
  const commissionPct = input.commissionPct ?? 0;
  const commission = commissionPct / 100;
  const cogsPct = 1 / markup;
  const netPerRm1 = (1 - commission) - cogsPct;
  const fx = fxToMyr(input.feeCurrency, a);
  const totalVendorCostMyr = ((input.listingFeeMonthly ?? 0) + (input.adSpendMonthly ?? 0)) * fx;

  const sensitivity = MARKUP_SCENARIOS.map((m) => {
    const net = (1 - commission) - 1 / m;
    return { markup: m, breakevenRrpMonthly: net > 0 && totalVendorCostMyr > 0 ? totalVendorCostMyr / net : null };
  });

  const base = {
    fx, markup, commissionPct, cogsPct, netPerRm1, totalVendorCostMyr,
    actualMonthlyRrp: input.actualMonthlyRrp, sensitivity,
    breakevenRrpMonthly: null as number | null,
    breakevenUnitsMonthly: null as number | null,
    breakevenUnitsDay: null as number | null,
    breakeven3MonthTrial: null as number | null,
    surplusMonthly: null as number | null,
    coverage: null as number | null,
  };

  if (totalVendorCostMyr <= 0) return { ...base, status: "NO_FEES" };
  if (netPerRm1 <= 0) return { ...base, status: "UNVIABLE" };

  const breakevenRrpMonthly = totalVendorCostMyr / netPerRm1;
  const breakevenUnitsMonthly = input.avgRrp && input.avgRrp > 0 ? breakevenRrpMonthly / input.avgRrp : null;
  const breakevenUnitsDay = breakevenUnitsMonthly != null ? breakevenUnitsMonthly / DAYS_PER_MONTH : null;
  const breakeven3MonthTrial = breakevenRrpMonthly * 3;

  let status: BreakevenStatus = "NO_DATA";
  let surplusMonthly: number | null = null;
  let coverage: number | null = null;
  if (input.actualMonthlyRrp != null && input.actualMonthlyRrp > 0) {
    surplusMonthly = input.actualMonthlyRrp - breakevenRrpMonthly;
    coverage = input.actualMonthlyRrp / breakevenRrpMonthly;
    status = surplusMonthly >= 0 ? "PROFITABLE" : "BELOW";
  }

  return {
    ...base, status, breakevenRrpMonthly, breakevenUnitsMonthly, breakevenUnitsDay,
    breakeven3MonthTrial, surplusMonthly, coverage,
  };
}

export interface BrandBreakeven extends BreakevenResult {
  avgRrp: number | null;
  actualUnits: number;
  actualRevenue: number;
  monthsActive: number;
  avgRrpBasis: "sales-weighted" | "catalog-average" | "none";
}

/**
 * Load a brand's inputs (fees + commission + markup) and its real sell-through,
 * derive the sales-weighted avg RRP and actual monthly run-rate, then compute.
 * Returns null if the brand doesn't exist.
 */
export async function brandBreakeven(
  brandId: string,
  assumptions?: BreakevenAssumptions,
): Promise<BrandBreakeven | null> {
  const a = assumptions ?? (await getAssumptions());
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) return null;

  const products = await prisma.product.findMany({
    where: { brandId },
    select: {
      retailPrice: true,
      lines: {
        select: { quantity: true, lineTotal: true, transaction: { select: { transactionDate: true } } },
      },
    },
  });

  let actualUnits = 0;
  let actualRevenue = 0;
  let earliest: Date | null = null;
  const catalogPrices: number[] = [];
  for (const p of products) {
    if (p.retailPrice != null && p.retailPrice > 0) catalogPrices.push(p.retailPrice);
    for (const l of p.lines) {
      actualUnits += l.quantity;
      actualRevenue += l.lineTotal;
      const d = l.transaction.transactionDate;
      if (!earliest || d < earliest) earliest = d;
    }
  }

  // Avg RRP: sales-weighted realized price when we have sales, else catalog mean.
  let avgRrp: number | null = null;
  let avgRrpBasis: BrandBreakeven["avgRrpBasis"] = "none";
  if (actualUnits > 0) {
    avgRrp = actualRevenue / actualUnits;
    avgRrpBasis = "sales-weighted";
  } else if (catalogPrices.length > 0) {
    avgRrp = catalogPrices.reduce((s, v) => s + v, 0) / catalogPrices.length;
    avgRrpBasis = "catalog-average";
  }

  // Monthly run-rate: revenue spread over the active window (trial start, or first
  // sale). At least 1 month so a fresh partner isn't flattered by a tiny window.
  const start = brand.trialStartDate ?? earliest ?? new Date();
  const monthsActive = Math.max(1, (Date.now() - start.getTime()) / (DAYS_PER_MONTH * 24 * 3600 * 1000));
  const actualMonthlyRrp = actualUnits > 0 ? actualRevenue / monthsActive : null;

  const result = computeBreakeven(
    {
      feeCurrency: brand.feeCurrency,
      listingFeeMonthly: brand.listingFeeMonthly,
      adSpendMonthly: brand.adSpendMonthly,
      commissionPct: brand.commissionPct,
      vendorMarkup: brand.vendorMarkup,
      avgRrp,
      actualMonthlyRrp,
    },
    a,
  );

  return { ...result, avgRrp, actualUnits, actualRevenue, monthsActive, avgRrpBasis };
}
