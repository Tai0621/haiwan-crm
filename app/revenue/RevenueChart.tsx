"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { SUPPLIER_COLORS } from "@/lib/constants";
import type { MonthlyRevenueRow } from "@/lib/analytics";

// Format "2026-05" -> "May 26"
function monthLabel(m: string): string {
  const [y, mo] = m.split("-");
  const d = new Date(parseInt(y), parseInt(mo) - 1, 1);
  return d.toLocaleDateString("en-MY", { month: "short", year: "2-digit" });
}

function rmTooltip(value: number): string {
  return "RM " + value.toLocaleString("en-MY", { maximumFractionDigits: 0 });
}

export default function RevenueChart({ data }: { data: MonthlyRevenueRow[] }) {
  const chartData = data.map((r) => ({ ...r, label: monthLabel(r.month) }));

  return (
    <ResponsiveContainer width="100%" height={420}>
      <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} />
        <YAxis tick={{ fontSize: 12, fill: "#64748b" }} tickFormatter={(v) => `RM${v / 1000}k`} />
        <Tooltip
          formatter={(value, name) => [rmTooltip(Number(value) || 0), String(name)]}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {/* Stacked: strategic priority (in-house) at the bottom */}
        <Bar dataKey="INHOUSE" stackId="rev" name="In-house" fill={SUPPLIER_COLORS.INHOUSE} />
        <Bar dataKey="CONSIGNMENT" stackId="rev" name="Consignment" fill={SUPPLIER_COLORS.CONSIGNMENT} />
        <Bar dataKey="TRADING" stackId="rev" name="Trading" fill={SUPPLIER_COLORS.TRADING} />
        <Bar dataKey="UNCLASSIFIED" stackId="rev" name="Unclassified" fill={SUPPLIER_COLORS.UNCLASSIFIED} />
      </BarChart>
    </ResponsiveContainer>
  );
}
