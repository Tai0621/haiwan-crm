// Customer purchase-journey card: a segment × month heatmap of what they buy
// and when, plus rule-based "fill the journey gap" recommendations.
// Pure server-rendered markup — no client JS.
import { fmtDate, rm } from "@/lib/format";
import type { JourneyProfile, Recommendation } from "@/lib/journey";

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthLabel(key: string): string {
  return MONTH_SHORT[Number(key.slice(5)) - 1] ?? key;
}

/** Segment color at an intensity scaled by count (0 → near-white). */
function cellStyle(color: string, count: number, max: number): React.CSSProperties {
  if (count === 0) return { backgroundColor: "#f1f5f9" }; // slate-100
  const alpha = 0.35 + 0.65 * Math.min(1, count / max);
  const hex = Math.round(alpha * 255).toString(16).padStart(2, "0");
  return { backgroundColor: `${color}${hex}` };
}

export default function JourneyCard({
  profile,
  recommendations,
}: {
  profile: JourneyProfile;
  recommendations: Recommendation[];
}) {
  const { months, rows, maxCell, totalUnits } = profile;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-1">Purchase journey</h2>
      <p className="text-xs text-slate-400 mb-4">
        What they buy from us, by lifestyle segment · last 12 months
      </p>

      {totalUnits === 0 ? (
        <p className="text-sm text-slate-400">No purchases yet — the journey starts with the first sale.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ borderCollapse: "separate", borderSpacing: "2px 4px" }}>
            <thead>
              <tr className="text-[10px] text-slate-400">
                <th className="text-left font-medium pr-2">Segment</th>
                {months.map((m) => (
                  <th key={m} className="font-medium text-center min-w-6">
                    {monthLabel(m)}
                    {m.endsWith("-01") && <div className="text-slate-300">{m.slice(0, 4)}</div>}
                  </th>
                ))}
                <th className="text-right font-medium pl-2">Items</th>
                <th className="text-right font-medium pl-2">Spend</th>
                <th className="text-right font-medium pl-2">Last</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="pr-2 whitespace-nowrap">
                    <span className="flex items-center gap-1.5 text-slate-700">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: r.color }} />
                      {r.label}
                    </span>
                  </td>
                  {r.monthUnits.map((n, i) => (
                    <td key={i} className="p-0">
                      <div
                        className="h-6 w-full min-w-6 rounded flex items-center justify-center text-[10px] font-medium"
                        style={cellStyle(r.color, n, maxCell)}
                        title={`${r.label} · ${monthLabel(months[i])} ${months[i].slice(0, 4)}: ${n} item${n === 1 ? "" : "s"}`}
                      >
                        {n > 0 && <span className="text-white drop-shadow-sm">{n}</span>}
                      </div>
                    </td>
                  ))}
                  <td className={`pl-2 text-right tabular-nums ${r.units === 0 ? "text-slate-300" : "text-slate-700"}`}>
                    {r.units}
                  </td>
                  <td className={`pl-2 text-right tabular-nums whitespace-nowrap ${r.units === 0 ? "text-slate-300" : "text-slate-600"}`}>
                    {r.spend > 0 ? rm(r.spend) : "—"}
                  </td>
                  <td className="pl-2 text-right text-xs text-slate-400 whitespace-nowrap">
                    {r.lastAt ? fmtDate(r.lastAt) : "never"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-1">Next best actions</h3>
          <p className="text-xs text-slate-400 mb-3">
            Journey gaps · proven sellers matched to their pets&apos; species and life stage
          </p>
          <ul className="space-y-2">
            {recommendations.map((rec) => (
              <li key={rec.segmentId} className="rounded-md border border-slate-200 px-3 py-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                  <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: rec.segmentColor }} />
                  {rec.segmentLabel}
                  <span className="font-normal text-slate-400">— {rec.reason}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {rec.products.map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200 px-2 py-0.5 text-xs text-slate-700"
                    >
                      {p.name}
                      {p.retailPrice != null && <span className="text-slate-400">{rm(p.retailPrice)}</span>}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
