import Link from "next/link";
import { monthlyRevenueMix, pct } from "@/lib/analytics";
import { SUPPLIER_COLORS } from "@/lib/constants";
import { rm } from "@/lib/format";
import { refreshRecentTransactions, storeHubConfigured } from "@/lib/storehub";
import RevenueChart from "./RevenueChartClient";

export const dynamic = "force-dynamic";

export default async function RevenuePage() {
  // Pull the latest StoreHub sales first (throttled + fail-safe) so the mix
  // reflects today's takings automatically, then compute from the CRM data.
  await refreshRecentTransactions();
  const data = await monthlyRevenueMix();
  const live = storeHubConfigured();

  // Totals across all months
  const totals = data.reduce(
    (acc, r) => {
      acc.INHOUSE += r.INHOUSE;
      acc.CONSIGNMENT += r.CONSIGNMENT;
      acc.TRADING += r.TRADING;
      acc.UNCLASSIFIED += r.UNCLASSIFIED;
      return acc;
    },
    { INHOUSE: 0, CONSIGNMENT: 0, TRADING: 0, UNCLASSIFIED: 0 },
  );
  const grand = totals.INHOUSE + totals.CONSIGNMENT + totals.TRADING + totals.UNCLASSIFIED;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Revenue mix</h1>
            {live && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Live from StoreHub
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">
            The north-star chart: monthly revenue split by supplier type. The strategy is working
            when the <span style={{ color: SUPPLIER_COLORS.INHOUSE }} className="font-medium">green
            in-house</span> band grows and <span style={{ color: SUPPLIER_COLORS.TRADING }} className="font-medium">amber
            trading</span> shrinks.
          </p>
        </div>
        <Link
          href="/finance"
          className="shrink-0 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Analysis →
        </Link>
      </div>

      {/* Lifetime split cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(
          [
            ["INHOUSE", "In-house"],
            ["CONSIGNMENT", "Consignment"],
            ["TRADING", "Trading"],
            ["UNCLASSIFIED", "Unclassified"],
          ] as const
        ).map(([k, label]) => (
          <div key={k} className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: SUPPLIER_COLORS[k] }} />
              {label}
            </div>
            <div className="text-2xl font-bold mt-1" style={{ color: SUPPLIER_COLORS[k] }}>
              {pct(totals[k], grand)}%
            </div>
            <div className="text-xs text-slate-400">{rm(totals[k])}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Monthly revenue by supplier type</h2>
        {data.length === 0 ? (
          <p className="text-sm text-slate-400">No transaction data yet.</p>
        ) : (
          <RevenueChart data={data} />
        )}
        <p className="text-xs text-slate-400 mt-3">
          Computed from transaction line-items joined to products. Lines with no matched product
          fall into &ldquo;Unclassified&rdquo;.
        </p>
      </div>
    </div>
  );
}
