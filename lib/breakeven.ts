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
import { monthKeyMYT } from "./format";

const DAYS_PER_MONTH = 30.4; // matches the workbook
const TREND_MONTHS = 12;

/** Last N month keys ("YYYY-MM") in MYT, oldest first. */
function lastMonthKeys(now: Date, n: number): string[] {
  const myt = new Date(now.getTime() + 8 * 60 * 60 * 1000); // shift so UTC getters read MYT
  const keys: string[] = [];
  let y = myt.getUTCFullYear();
  let m = myt.getUTCMonth();
  for (let i = 0; i < n; i++) {
    keys.unshift(`${y}-${String(m + 1).padStart(2, "0")}`);
    if (--m < 0) { m = 11; y--; }
  }
  return keys;
}

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
  avgRrpBasis: "sales-weighted" | "expected" | "catalog-average" | "none";
  monthly: Array<{ month: string; rrp: number }>; // last 12 MYT months of RRP sales
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
  const monthKeys = lastMonthKeys(new Date(), TREND_MONTHS);
  const monthIdx = new Map(monthKeys.map((k, i) => [k, i]));
  const monthRrp = monthKeys.map(() => 0);
  for (const p of products) {
    if (p.retailPrice != null && p.retailPrice > 0) catalogPrices.push(p.retailPrice);
    for (const l of p.lines) {
      actualUnits += l.quantity;
      actualRevenue += l.lineTotal;
      const d = l.transaction.transactionDate;
      if (!earliest || d < earliest) earliest = d;
      const idx = monthIdx.get(monthKeyMYT(d));
      if (idx !== undefined) monthRrp[idx] += l.lineTotal;
    }
  }
  const monthly = monthKeys.map((month, i) => ({ month, rrp: monthRrp[i] }));

  // Avg RRP: sales-weighted realized price once we have sales; before that, the
  // partner's own target avg RRP (their intended sales mix) if set; else a plain
  // catalog mean as a last resort.
  let avgRrp: number | null = null;
  let avgRrpBasis: BrandBreakeven["avgRrpBasis"] = "none";
  if (actualUnits > 0) {
    avgRrp = actualRevenue / actualUnits;
    avgRrpBasis = "sales-weighted";
  } else if (brand.expectedAvgRrp != null && brand.expectedAvgRrp > 0) {
    avgRrp = brand.expectedAvgRrp;
    avgRrpBasis = "expected";
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

  return { ...result, avgRrp, actualUnits, actualRevenue, monthsActive, avgRrpBasis, monthly };
}

// ---------------------------------------------------------------------------
// Portfolio roll-up — the aggregate breakeven KPI across all consignment
// partners (the workbook's "Portfolio Total" row + an actual-vs-target lens).
// ---------------------------------------------------------------------------

export interface PortfolioRow {
  id: string;
  name: string;
  feesMonthly: number;
  breakevenMonthly: number;
  actualMonthly: number | null;
  coverage: number | null;
  status: BreakevenStatus;
  unitsDay: number | null;
}

export interface ConsignmentPortfolio {
  partnerCount: number;         // partners with a breakeven target (fees set)
  totalFeesMonthly: number;     // combined monthly fees partners pay (RM)
  totalBreakevenMonthly: number;// combined RRP sales needed to all break even (RM)
  totalBreakeven3Month: number; // combined 3-month trial breakeven (RM)
  totalActualMonthly: number;   // combined actual RRP run-rate (RM)
  coverage: number | null;      // totalActual / totalBreakeven
  surplusMonthly: number;       // totalActual - totalBreakeven
  profitable: number;
  below: number;
  noSales: number;
  rows: PortfolioRow[];         // most at-risk first
}

const STATUS_SORT: Record<BreakevenStatus, number> = {
  BELOW: 0, UNVIABLE: 1, NO_DATA: 2, PROFITABLE: 3, NO_FEES: 4,
};

/** Aggregate breakeven across every consignment / co-creation partner. */
export async function consignmentPortfolio(
  assumptions?: BreakevenAssumptions,
): Promise<ConsignmentPortfolio> {
  const a = assumptions ?? (await getAssumptions());
  const brands = await prisma.brand.findMany({
    where: { supplierType: { in: ["CONSIGNMENT", "CO_CREATION"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const computed = await Promise.all(
    brands.map(async (b) => ({ b, be: await brandBreakeven(b.id, a) })),
  );

  const rows: PortfolioRow[] = [];
  let totalFeesMonthly = 0, totalBreakevenMonthly = 0, totalBreakeven3Month = 0, totalActualMonthly = 0;
  let profitable = 0, below = 0, noSales = 0;

  for (const { b, be } of computed) {
    if (!be || be.breakevenRrpMonthly == null) continue; // untracked (no fees) or unviable
    totalFeesMonthly += be.totalVendorCostMyr;
    totalBreakevenMonthly += be.breakevenRrpMonthly;
    totalBreakeven3Month += be.breakeven3MonthTrial ?? 0;
    totalActualMonthly += be.actualMonthlyRrp ?? 0;
    if (be.status === "PROFITABLE") profitable++;
    else if (be.status === "BELOW") below++;
    else noSales++;
    rows.push({
      id: b.id, name: b.name, feesMonthly: be.totalVendorCostMyr,
      breakevenMonthly: be.breakevenRrpMonthly, actualMonthly: be.actualMonthlyRrp,
      coverage: be.coverage, status: be.status, unitsDay: be.breakevenUnitsDay,
    });
  }
  rows.sort((x, y) => STATUS_SORT[x.status] - STATUS_SORT[y.status] || y.breakevenMonthly - x.breakevenMonthly);

  return {
    partnerCount: rows.length,
    totalFeesMonthly, totalBreakevenMonthly, totalBreakeven3Month, totalActualMonthly,
    coverage: totalBreakevenMonthly > 0 ? totalActualMonthly / totalBreakevenMonthly : null,
    surplusMonthly: totalActualMonthly - totalBreakevenMonthly,
    profitable, below, noSales, rows,
  };
}
