"use client";

import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  PieChart, Pie, Legend,
} from "recharts";

export interface BreakevenChartsProps {
  monthly: Array<{ month: string; rrp: number }>;
  breakevenRrpMonthly: number | null;
  sensitivity: Array<{ markup: number; breakevenRrpMonthly: number | null }>;
  currentMarkup: number;
  commissionPct: number; // e.g. 30
  cogsPct: number;       // 0..1
  netPerRm1: number;     // RM per RM1 RRP
}

const NAVY = "#213a5c";
const EMERALD = "#10b981";
const ROSE = "#f43f5e";
const AMBER = "#f59e0b";
const SLATE = "#94a3b8";
const AXIS = "#64748b";

function monthLabel(m: string): string {
  const [y, mo] = m.split("-");
  return new Date(parseInt(y), parseInt(mo) - 1, 1)
    .toLocaleDateString("en-MY", { month: "short", year: "2-digit" });
}
const rmShort = (v: number) =>
  v >= 1000 ? `RM${(v / 1000).toFixed(1)}k` : `RM${Math.round(v)}`;
const rmFull = (v: number) => "RM " + Math.round(v).toLocaleString("en-MY");
const tipStyle = { fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" } as const;

export default function BreakevenCharts(p: BreakevenChartsProps) {
  const hasSales = p.monthly.some((m) => m.rrp > 0);
  const trend = p.monthly.map((m) => ({ ...m, label: monthLabel(m.month) }));
  const sens = p.sensitivity
    .filter((s) => s.breakevenRrpMonthly != null)
    .map((s) => ({ label: `${s.markup}×`, value: s.breakevenRrpMonthly as number, markup: s.markup }));

  const netPositive = p.netPerRm1 > 0;
  const rm1 = [
    { name: "Haiwan commission", value: p.commissionPct / 100, fill: NAVY },
    { name: "Vendor COGS", value: p.cogsPct, fill: AMBER },
    ...(netPositive ? [{ name: "Vendor keeps", value: p.netPerRm1, fill: EMERALD }] : []),
  ];

  return (
    <div className="mt-5 space-y-5 border-t border-slate-100 pt-4">
      {/* Monthly sell-through vs breakeven */}
      {hasSales && p.breakevenRrpMonthly != null && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Monthly RRP sales vs breakeven
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: AXIS }} tickFormatter={(v) => rmShort(Number(v))} width={48} />
              <Tooltip formatter={(v) => [rmFull(Number(v) || 0), "RRP sales"]} contentStyle={tipStyle} />
              <ReferenceLine
                y={p.breakevenRrpMonthly}
                stroke={ROSE}
                strokeDasharray="5 4"
                label={{ value: `Breakeven ${rmShort(p.breakevenRrpMonthly)}`, position: "insideTopRight", fontSize: 10, fill: ROSE }}
              />
              <Bar dataKey="rrp" name="RRP sales" radius={[3, 3, 0, 0]}>
                {trend.map((m, i) => (
                  <Cell key={i} fill={m.rrp >= (p.breakevenRrpMonthly as number) ? EMERALD : SLATE} />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
          <p className="mt-1 text-xs text-slate-400">
            Green months cleared breakeven; grey fell short. Dashed line = fees to cover.
          </p>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        {/* Where each RM1 of RRP goes */}
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Where each RM1 of RRP goes
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={rm1}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={42}
                outerRadius={70}
                paddingAngle={2}
              >
                {rm1.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [`RM ${(Number(v) || 0).toFixed(2)}`, String(n)]} contentStyle={tipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconSize={9} />
            </PieChart>
          </ResponsiveContainer>
          {!netPositive && (
            <p className="mt-1 text-center text-xs text-rose-500">
              Commission + COGS exceed RRP — nothing left for the vendor.
            </p>
          )}
        </div>

        {/* Markup sensitivity */}
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Breakeven RRP / mth by markup
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={sens} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS }} />
              <YAxis tick={{ fontSize: 11, fill: AXIS }} tickFormatter={(v) => rmShort(Number(v))} width={48} />
              <Tooltip formatter={(v) => [rmFull(Number(v) || 0), "Breakeven RRP"]} contentStyle={tipStyle} />
              <Bar dataKey="value" name="Breakeven RRP" radius={[3, 3, 0, 0]}>
                {sens.map((s, i) => (
                  <Cell key={i} fill={s.markup === p.currentMarkup ? NAVY : "#cbd5e1"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="mt-1 text-xs text-slate-400">Navy = this partner&apos;s markup. Lower markup needs more volume.</p>
        </div>
      </div>
    </div>
  );
}
