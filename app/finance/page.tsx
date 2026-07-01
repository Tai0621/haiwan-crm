import { monthlyMarginMix, marginSummary, pct, type SupplierBucket } from "@/lib/analytics";
import { SUPPLIER_COLORS, SUPPLIER_LABELS } from "@/lib/constants";
import { rm } from "@/lib/format";
import { refreshRecentTransactions, storeHubConfigured } from "@/lib/storehub";
import { prisma } from "@/lib/db";
import { setInhouseTarget } from "./actions";

export const dynamic = "force-dynamic";

const BUCKETS: SupplierBucket[] = ["INHOUSE", "CONSIGNMENT", "TRADING", "UNCLASSIFIED"];

function marginPct(gp: number, rev: number): number {
  return rev > 0 ? Math.round((gp / rev) * 100) : 0;
}

export default async function FinancePage() {
  await refreshRecentTransactions();
  const [months, setting] = await Promise.all([
    monthlyMarginMix(),
    prisma.appSetting.findUnique({ where: { id: "default" } }),
  ]);
  const summary = await marginSummary(months);
  const target = setting?.targetInhousePct ?? 0;
  const live = storeHubConfigured();

  const onTrack = summary.inhouseRevenuePct >= target;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Finance — margin &amp; mix</h1>
          {live && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Live from StoreHub
            </span>
          )}
        </div>
        <p className="text-sm text-slate-500">
          The number finance trusts: revenue, COGS and gross profit by supplier type. Same basis as the
          revenue-mix chart, reconcilable against the management accounts.
        </p>
      </div>

      {/* In-house target progress */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-sm text-slate-500">In-house revenue share</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-4xl font-bold" style={{ color: SUPPLIER_COLORS.INHOUSE }}>
                {summary.inhouseRevenuePct.toFixed(1)}%
              </span>
              <span className="text-sm text-slate-400">of revenue · {summary.inhouseMarginPct.toFixed(1)}% of gross profit</span>
            </div>
          </div>
          <form action={setInhouseTarget} className="flex items-end gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Target in-house %</label>
              <input
                name="targetInhousePct"
                type="number"
                step="1"
                min="0"
                max="100"
                defaultValue={target}
                className="w-24 rounded-md border border-slate-200 px-2.5 py-1.5 text-sm"
              />
            </div>
            <button className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
              Set target
            </button>
          </form>
        </div>
        {target > 0 && (
          <div className="mt-4">
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, (summary.inhouseRevenuePct / target) * 100)}%`,
                  backgroundColor: onTrack ? SUPPLIER_COLORS.INHOUSE : "#f59e0b",
                }}
              />
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {onTrack
                ? `On target (${summary.inhouseRevenuePct.toFixed(1)}% ≥ ${target}%).`
                : `${(target - summary.inhouseRevenuePct).toFixed(1)} points below the ${target}% target.`}
            </div>
          </div>
        )}
      </div>

      {/* By supplier type */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">By supplier type (lifetime)</h2>
          <a href="/export/finance" download className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700">
            Export CSV
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Supplier type</th>
                <th className="px-3 py-2 font-medium text-right">Revenue</th>
                <th className="px-3 py-2 font-medium text-right">COGS</th>
                <th className="px-3 py-2 font-medium text-right">Gross profit</th>
                <th className="px-3 py-2 font-medium text-right">Margin %</th>
                <th className="px-3 py-2 font-medium text-right">% of revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {BUCKETS.map((k) => {
                const b = summary.buckets[k];
                if (b.revenue === 0) return null;
                return (
                  <tr key={k} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: SUPPLIER_COLORS[k] }} />
                        {SUPPLIER_LABELS[k] ?? "Unclassified"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">{rm(b.revenue)}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{k === "UNCLASSIFIED" ? "—" : rm(b.cogs)}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{k === "UNCLASSIFIED" ? "—" : rm(b.grossProfit)}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{k === "UNCLASSIFIED" ? "—" : `${marginPct(b.grossProfit, b.revenue)}%`}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{pct(b.revenue, summary.totalRevenue)}%</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-slate-200 font-semibold">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right">{rm(summary.totalRevenue)}</td>
                <td className="px-3 py-2 text-right">{rm(summary.totalCogs)}</td>
                <td className="px-3 py-2 text-right">{rm(summary.totalGrossProfit)}</td>
                <td className="px-3 py-2 text-right">{marginPct(summary.totalGrossProfit, summary.totalRevenue)}%</td>
                <td className="px-3 py-2 text-right">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
        {summary.unclassifiedRevenue > 0 && (
          <div className="border-t border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
            <strong>Reconciliation gap:</strong> {rm(summary.unclassifiedRevenue)} of revenue is on lines with no matched
            product ({pct(summary.unclassifiedRevenue, summary.totalRevenue)}%) — no cost/margin can be attributed. Match
            these products to close the gap against the accounts.
          </div>
        )}
      </div>

      {/* Monthly trend */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">Monthly</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Month</th>
                <th className="px-3 py-2 font-medium text-right">Revenue</th>
                <th className="px-3 py-2 font-medium text-right">COGS</th>
                <th className="px-3 py-2 font-medium text-right">Gross profit</th>
                <th className="px-3 py-2 font-medium text-right">In-house rev %</th>
                <th className="px-3 py-2 font-medium text-right">In-house GP %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {months.map((m) => {
                const rev = BUCKETS.reduce((s, k) => s + m[k].revenue, 0);
                const cogs = BUCKETS.reduce((s, k) => s + m[k].cogs, 0);
                const gp = rev - cogs;
                return (
                  <tr key={m.month} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-700">{m.month}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{rm(rev)}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{rm(cogs)}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{rm(gp)}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{pct(m.INHOUSE.revenue, rev)}%</td>
                    <td className="px-3 py-2 text-right text-slate-600">{pct(m.INHOUSE.grossProfit, gp)}%</td>
                  </tr>
                );
              })}
              {months.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No transaction data yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
