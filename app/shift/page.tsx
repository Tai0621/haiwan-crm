import Link from "next/link";
import { prisma } from "@/lib/db";
import { currentRole } from "@/lib/auth";
import { fmtDate, fmtDateTime } from "@/lib/format";
import type { SopItem, Priority, Scope } from "@/lib/shift-checklist";
import ShiftChecklist from "./ShiftChecklist";

export const dynamic = "force-dynamic";

const SHIFT_LABEL: Record<string, string> = { OPENING: "Opening", CLOSING: "Closing" };

export default async function ShiftPage() {
  const role = await currentRole();
  const [rows, logs] = await Promise.all([
    prisma.shiftChecklistItem.findMany({
      where: { active: true },
      orderBy: [{ sectionOrder: "asc" }, { sortOrder: "asc" }],
    }),
    role === "management"
      ? prisma.shiftLog.findMany({ orderBy: { signedAt: "desc" }, take: 25 })
      : Promise.resolve([]),
  ]);

  const items: SopItem[] = rows.map((r) => ({
    id: r.id,
    section: r.section,
    sectionOrder: r.sectionOrder,
    sortOrder: r.sortOrder,
    shift: r.shift as Scope,
    pjShift: r.pjShift as Scope | null,
    label: r.label,
    note: r.note,
    priority: r.priority as Priority,
    storeKL: r.storeKL,
    storePJ: r.storePJ,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Shift checklist</h1>
          <p className="text-sm text-slate-500">
            Opening &amp; closing store readiness — sign off when it&apos;s done, so the next shift starts clean.
          </p>
        </div>
        {role === "management" && (
          <Link href="/shift/edit" className="shrink-0 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Edit checklist
          </Link>
        )}
      </div>

      <ShiftChecklist items={items} />

      {role === "management" && (
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-lg font-semibold text-slate-900">Recent sign-offs</h2>
            <p className="text-xs text-slate-400">The accountability trail — who opened / closed, when, and how complete.</p>
          </div>
          {logs.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">No shift sign-offs yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Shift</th>
                    <th className="px-3 py-2 font-medium">Branch</th>
                    <th className="px-3 py-2 font-medium">Staff</th>
                    <th className="px-3 py-2 font-medium text-right">Done</th>
                    <th className="px-3 py-2 font-medium">Supervisor</th>
                    <th className="px-3 py-2 font-medium">Remarks</th>
                    <th className="px-3 py-2 font-medium">Signed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((l) => {
                    const complete = l.itemsTotal > 0 && l.itemsDone >= l.itemsTotal;
                    return (
                      <tr key={l.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-700">{fmtDate(l.businessDate)}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${l.shift === "OPENING" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                            {SHIFT_LABEL[l.shift]}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-600">{l.store}</td>
                        <td className="px-3 py-2 text-slate-700">{l.staffName}</td>
                        <td className={`px-3 py-2 text-right font-medium ${complete ? "text-emerald-600" : "text-amber-600"}`}>
                          {l.itemsDone}/{l.itemsTotal}
                        </td>
                        <td className="px-3 py-2 text-slate-500">{l.supervisorName ?? "—"}</td>
                        <td className="px-3 py-2 text-slate-500 max-w-[16rem] truncate" title={l.remarks ?? ""}>{l.remarks ?? "—"}</td>
                        <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{fmtDateTime(l.signedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
