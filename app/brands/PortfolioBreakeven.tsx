import Link from "next/link";
import { rm } from "@/lib/format";
import type { ConsignmentPortfolio, PortfolioRow } from "@/lib/breakeven";

const STATUS: Record<string, { label: string; cls: string }> = {
  PROFITABLE: { label: "Above breakeven", cls: "bg-emerald-100 text-emerald-700" },
  BELOW: { label: "Below breakeven", cls: "bg-rose-100 text-rose-700" },
  NO_DATA: { label: "No sales yet", cls: "bg-slate-100 text-slate-500" },
  UNVIABLE: { label: "Unviable", cls: "bg-amber-100 text-amber-700" },
  NO_FEES: { label: "No fees", cls: "bg-slate-100 text-slate-500" },
};

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <div className="text-xl font-bold tabular-nums text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

export default function PortfolioBreakeven({ p }: { p: ConsignmentPortfolio }) {
  if (p.partnerCount === 0) return null;

  const cov = p.coverage ?? 0;
  const covPct = Math.round(cov * 100);
  const barPct = Math.min(100, covPct);
  const barColor = cov >= 1 ? "bg-emerald-500" : cov > 0 ? "bg-amber-500" : "bg-slate-300";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">Portfolio breakeven KPI</h3>
        <span className="text-xs text-slate-400">{p.partnerCount} fee-paying partners</span>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Combined RRP sales the partners must reach so each covers its own listing fees + ad spend.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Fees they pay / mo" value={rm(p.totalFeesMonthly)} sub="listing + ad spend, in RM" />
        <Tile label="Breakeven target / mo" value={rm(p.totalBreakevenMonthly)} sub="combined RRP sales" />
        <Tile label="Actual run-rate / mo" value={rm(p.totalActualMonthly)} sub="from real sell-through" />
        <Tile label="3-month trial target" value={rm(p.totalBreakeven3Month)} />
      </div>

      {/* Coverage: how close the portfolio is to its combined breakeven. */}
      <div className="mt-4">
        <div className="mb-1 flex items-baseline justify-between text-sm">
          <span className="font-medium text-slate-700">Portfolio coverage</span>
          <span className={`font-semibold tabular-nums ${cov >= 1 ? "text-emerald-600" : cov > 0 ? "text-amber-600" : "text-slate-400"}`}>
            {covPct}%
            {p.surplusMonthly !== 0 && (
              <span className="ml-1 text-xs font-normal text-slate-400">
                ({p.surplusMonthly >= 0 ? "+" : "−"}{rm(Math.abs(p.surplusMonthly)).replace("RM ", "RM ")} vs target)
              </span>
            )}
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barPct}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span><span className="font-semibold text-emerald-600">{p.profitable}</span> above breakeven</span>
          <span><span className="font-semibold text-rose-600">{p.below}</span> below</span>
          <span><span className="font-semibold text-slate-500">{p.noSales}</span> no sales yet</span>
        </div>
      </div>

      {/* Per-partner breakdown, most at-risk first. */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="py-1.5 font-medium">Partner</th>
              <th className="py-1.5 font-medium text-right">Breakeven / mo</th>
              <th className="py-1.5 font-medium text-right">Actual / mo</th>
              <th className="py-1.5 font-medium text-right">Units / day</th>
              <th className="py-1.5 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {p.rows.map((r: PortfolioRow) => {
              const s = STATUS[r.status] ?? STATUS.NO_DATA;
              return (
                <tr key={r.id}>
                  <td className="py-2">
                    <Link href={`/brands/${r.id}`} className="font-medium text-slate-800 hover:underline">{r.name}</Link>
                  </td>
                  <td className="py-2 text-right tabular-nums text-slate-700">{rm(r.breakevenMonthly)}</td>
                  <td className="py-2 text-right tabular-nums text-slate-600">{r.actualMonthly != null ? rm(r.actualMonthly) : "—"}</td>
                  <td className="py-2 text-right tabular-nums text-slate-500">{r.unitsDay != null ? r.unitsDay.toFixed(2) : "—"}</td>
                  <td className="py-2 text-right">
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${s.cls}`}>
                      {s.label}{r.coverage != null ? ` · ${Math.round(r.coverage * 100)}%` : ""}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 font-semibold text-slate-800">
              <td className="py-2">Portfolio total</td>
              <td className="py-2 text-right tabular-nums">{rm(p.totalBreakevenMonthly)}</td>
              <td className="py-2 text-right tabular-nums">{rm(p.totalActualMonthly)}</td>
              <td className="py-2 text-right"></td>
              <td className="py-2 text-right tabular-nums">{p.coverage != null ? `${Math.round(p.coverage * 100)}%` : "—"}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
