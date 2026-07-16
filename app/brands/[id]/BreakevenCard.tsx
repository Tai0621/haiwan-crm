import type { BrandBreakeven } from "@/lib/breakeven";
import { rm } from "@/lib/format";

const num0 = (n: number) => n.toLocaleString("en-MY", { maximumFractionDigits: 0 });
const num1 = (n: number) => n.toLocaleString("en-MY", { maximumFractionDigits: 1 });
const pct = (f: number) => `${Math.round(f * 100)}%`;

const STATUS: Record<
  BrandBreakeven["status"],
  { label: string; sub: (b: BrandBreakeven) => string; cls: string; bar: string }
> = {
  PROFITABLE: {
    label: "Above breakeven — partner is profitable",
    sub: (b) => `RM ${num0(b.surplusMonthly ?? 0)} surplus / month · covering ${num0((b.coverage ?? 0) * 100)}% of breakeven`,
    cls: "bg-emerald-50 text-emerald-800 border-emerald-200",
    bar: "bg-emerald-500",
  },
  BELOW: {
    label: "Below breakeven — losing money on fees",
    sub: (b) => `RM ${num0(Math.abs(b.surplusMonthly ?? 0))} short / month · covering only ${num0((b.coverage ?? 0) * 100)}% of breakeven`,
    cls: "bg-rose-50 text-rose-800 border-rose-200",
    bar: "bg-rose-500",
  },
  UNVIABLE: {
    label: "Unviable — can't break even at any volume",
    sub: () => "Commission + COGS leave nothing per RM1 of RRP. Lower the commission or raise the markup.",
    cls: "bg-rose-50 text-rose-800 border-rose-200",
    bar: "bg-rose-500",
  },
  NO_FEES: {
    label: "No program fees recorded",
    sub: () => "Add this partner's monthly listing fee / ad spend below to track their breakeven.",
    cls: "bg-slate-50 text-slate-600 border-slate-200",
    bar: "bg-slate-300",
  },
  NO_DATA: {
    label: "Breakeven target set — no sales yet",
    sub: (b) => `Partner needs RM ${num0(b.breakevenRrpMonthly ?? 0)} of RRP sales / month to clear fees.`,
    cls: "bg-amber-50 text-amber-800 border-amber-200",
    bar: "bg-amber-400",
  },
};

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-sm text-slate-500">{label}{hint && <span className="ml-1 text-xs text-slate-400">{hint}</span>}</span>
      <span className="text-sm font-medium tabular-nums text-slate-800">{value}</span>
    </div>
  );
}

export default function BreakevenCard({ b }: { b: BrandBreakeven }) {
  const s = STATUS[b.status];
  const coverage = b.coverage != null ? Math.min(1.5, Math.max(0, b.coverage)) : null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Partner breakeven</h2>
        <span className="text-xs text-slate-400">Can they make money with us?</span>
      </div>

      {/* Verdict */}
      <div className={`mt-3 rounded-lg border px-4 py-3 ${s.cls}`}>
        <div className="text-sm font-semibold">{s.label}</div>
        <div className="mt-0.5 text-xs opacity-90">{s.sub(b)}</div>
        {coverage != null && b.breakevenRrpMonthly != null && (
          <div className="mt-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/60">
              <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${(coverage / 1.5) * 100}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-[11px] opacity-80">
              <span>Actual RM {num0(b.actualMonthlyRrp ?? 0)}/mo</span>
              <span>Breakeven RM {num0(b.breakevenRrpMonthly)}/mo</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-x-8 gap-y-1 sm:grid-cols-2">
        {/* Fee build-up */}
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Monthly cost to the vendor</h3>
          <Row label="Total program fees" hint={b.fx !== 1 ? `· FX ${num1(b.fx)}` : undefined} value={`RM ${num0(b.totalVendorCostMyr)}`} />
          <Row label="Haiwan commission" value={pct(b.commissionPct / 100)} />
          <Row label={`COGS at ${num1(b.markup)}× markup`} value={pct(b.cogsPct)} />
          <div className="mt-1 border-t border-slate-100 pt-1.5">
            <Row label="Vendor net per RM1 RRP" value={b.netPerRm1 > 0 ? `RM ${b.netPerRm1.toFixed(2)}` : "—"} />
          </div>
        </div>

        {/* Breakeven targets */}
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Breakeven needed</h3>
          <Row label="RRP sales / month" value={b.breakevenRrpMonthly != null ? `RM ${num0(b.breakevenRrpMonthly)}` : "—"} />
          <Row
            label="Units / month"
            hint={b.avgRrp != null ? `· avg RRP RM ${num0(b.avgRrp)}` : undefined}
            value={b.breakevenUnitsMonthly != null ? num0(b.breakevenUnitsMonthly) : "—"}
          />
          <Row label="Units / day" value={b.breakevenUnitsDay != null ? num1(b.breakevenUnitsDay) : "—"} />
          <Row label="3-month trial (RRP)" value={b.breakeven3MonthTrial != null ? `RM ${num0(b.breakeven3MonthTrial)}` : "—"} />
        </div>
      </div>

      {/* Actual context */}
      {b.actualUnits > 0 && (
        <p className="mt-3 text-xs text-slate-400">
          Actual: {num0(b.actualUnits)} units · {rm(b.actualRevenue)} over {num1(b.monthsActive)} mth
          {b.avgRrpBasis === "sales-weighted" ? " · avg RRP is sales-weighted from real sell-through" : ""}.
        </p>
      )}
      {b.actualUnits === 0 && b.avgRrpBasis === "catalog-average" && (
        <p className="mt-3 text-xs text-slate-400">Avg RRP is a catalog average (no sales yet to weight by).</p>
      )}

      {/* Sensitivity */}
      {b.status !== "NO_FEES" && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Breakeven RRP sales / mth vs vendor markup
          </h3>
          <div className="flex flex-wrap gap-2">
            {b.sensitivity.map((sc) => (
              <div
                key={sc.markup}
                className={`rounded-md border px-2.5 py-1.5 text-center ${sc.markup === b.markup ? "border-slate-300 bg-slate-50" : "border-slate-200"}`}
              >
                <div className="text-[11px] text-slate-400">{num1(sc.markup)}× cost</div>
                <div className="text-sm font-medium tabular-nums text-slate-800">
                  {sc.breakevenRrpMonthly != null ? `RM ${num0(sc.breakevenRrpMonthly)}` : "—"}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Lower markup = thinner vendor margin = more volume needed to clear the same fees.
          </p>
        </div>
      )}
    </div>
  );
}
