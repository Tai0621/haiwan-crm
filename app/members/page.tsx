import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  memberViews,
  statusCounts,
  reconcileMemberships,
  TIERS,
  TIER_BASIS,
  type MemberView,
} from "@/lib/membership";
import { claimMembershipAction, queueActivation } from "@/app/actions/membership";
import { renderTemplate } from "@/lib/templates";
import { whatsappLink, formatPhoneDisplay } from "@/lib/phone";
import { fmtDate, rm } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  PROSPECT: "bg-slate-100 text-slate-600",
  ACTIVE: "bg-emerald-100 text-emerald-700",
  LAPSED: "bg-rose-100 text-rose-700",
};

export default async function MembersPage() {
  // Keep stored statuses current (lapse/re-activate) before reading.
  await reconcileMemberships();

  const [counts, views] = await Promise.all([statusCounts(), memberViews()]);

  const prospects = views
    .filter((v) => v.memberStatus === "PROSPECT")
    .sort((a, b) => b.lifetimeSpend - a.lifetimeSpend);
  const members = views
    .filter((v) => v.memberStatus !== "PROSPECT")
    .sort((a, b) => b.lifetimeSpend - a.lifetimeSpend);

  // Tier distribution among activated members.
  const tierCounts = new Map<string, number>();
  for (const m of members) tierCounts.set(m.tier.name, (tierCounts.get(m.tier.name) ?? 0) + 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Members</h1>
        <p className="text-sm text-slate-500">
          Membership status is the spine. Tier is computed on {TIER_BASIS === "lifetime" ? "lifetime spend" : TIER_BASIS === "rolling12" ? "rolling 12-month spend" : "points"}.
        </p>
      </div>

      {/* Status tiles */}
      <div className="grid grid-cols-3 gap-4">
        <Tile label="Prospects" value={counts.PROSPECT} accent="slate" />
        <Tile label="Active" value={counts.ACTIVE} accent="emerald" />
        <Tile label="Lapsed" value={counts.LAPSED} accent="rose" />
      </div>

      {/* Members to activate */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">Members to activate</h2>
          <p className="text-xs text-slate-400">Past customers who haven&apos;t claimed — highest lifetime spend first</p>
        </div>
        {prospects.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">No prospects to activate. 🎉</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {prospects.slice(0, 50).map((m) => {
              const wa = whatsappLink(m.phone, renderTemplate("activation", { customerName: m.name }));
              return (
                <li key={m.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/customers/${m.id}`} className="truncate font-medium text-slate-900 hover:underline">
                        {m.name ?? "Unnamed"}
                      </Link>
                      <span className="font-mono text-xs text-slate-400">{formatPhoneDisplay(m.phone)}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      Lifetime spend {rm(m.lifetimeSpend)} · {m.petCount} pet{m.petCount === 1 ? "" : "s"}
                      {m.lastPurchase ? ` · last bought ${fmtDate(m.lastPurchase)}` : " · no purchases"}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    {wa && (
                      <a href={wa} target="_blank" rel="noopener noreferrer" className="rounded bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700">
                        WhatsApp
                      </a>
                    )}
                    <form action={queueActivation} className="inline">
                      <input type="hidden" name="customerId" value={m.id} />
                      <button className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                        Queue follow-up
                      </button>
                    </form>
                    <form action={claimMembershipAction} className="inline">
                      <input type="hidden" name="customerId" value={m.id} />
                      <button className="rounded bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800">
                        Claim
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Tier distribution */}
      {members.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Tier distribution</h2>
          <div className="flex flex-wrap gap-4">
            {TIERS.map((t) => (
              <div key={t.name} className="flex items-center gap-2 text-sm">
                <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: t.color }} />
                <span className="text-slate-700">{t.name}</span>
                <span className="font-medium text-slate-900">{tierCounts.get(t.name) ?? 0}</span>
                <span className="text-xs text-slate-400">(≥ {rm(t.min)})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All members */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">Members ({members.length})</h2>
        </div>
        {members.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">No activated members yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Member</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Tier</th>
                  <th className="px-3 py-2 font-medium text-right">Lifetime spend</th>
                  <th className="px-3 py-2 font-medium text-right">Points</th>
                  <th className="px-3 py-2 font-medium">Last bought</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((m: MemberView) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <Link href={`/customers/${m.id}`} className="font-medium text-slate-900 hover:underline">
                        {m.name ?? "Unnamed"}
                      </Link>
                      <div className="font-mono text-xs text-slate-400">{m.memberId ?? "—"}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${STATUS_STYLES[m.memberStatus]}`}>
                        {m.memberStatus}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: m.tier.color }} />
                        {m.tier.name}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">{rm(m.lifetimeSpend)}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{m.pointsBalance}</td>
                    <td className="px-3 py-2 text-slate-500">{m.lastPurchase ? fmtDate(m.lastPurchase) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: number; accent: "slate" | "emerald" | "rose" }) {
  const color = accent === "emerald" ? "text-emerald-600" : accent === "rose" ? "text-rose-600" : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
    </div>
  );
}
