import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentRole } from "@/lib/auth";
import { SECTIONS, SCOPE_LABELS, PRIORITY_LABELS, type Priority, type Scope } from "@/lib/shift-checklist";
import { createChecklistItem, updateChecklistItem, deleteChecklistItem } from "./actions";

export const dynamic = "force-dynamic";

const inp = "rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:border-slate-400 focus:outline-none";
const lbl = "block text-[11px] font-medium text-slate-500 mb-0.5";

function SectionSelect({ value }: { value?: string }) {
  return (
    <select name="section" defaultValue={value ?? SECTIONS[1].title} className={`${inp} w-full`}>
      {SECTIONS.map((s) => <option key={s.title} value={s.title}>{s.title}</option>)}
    </select>
  );
}
function ShiftSelect({ value }: { value?: Scope }) {
  return (
    <select name="shift" defaultValue={value ?? "BOTH"} className={`${inp} w-full`}>
      {(["BOTH", "OPENING", "CLOSING"] as const).map((s) => <option key={s} value={s}>{SCOPE_LABELS[s]}</option>)}
    </select>
  );
}
function PrioritySelect({ value }: { value?: Priority }) {
  return (
    <select name="priority" defaultValue={value ?? "med"} className={`${inp} w-full`}>
      {(["high", "med", "low"] as const).map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
    </select>
  );
}
function PjShiftSelect({ value }: { value?: Scope | null }) {
  return (
    <select name="pjShift" defaultValue={value ?? ""} className={`${inp} w-full`} title="Override the shift for PJ only (e.g. waste at closing only)">
      <option value="">PJ: same</option>
      <option value="BOTH">PJ: both</option>
      <option value="OPENING">PJ: opening</option>
      <option value="CLOSING">PJ: closing</option>
    </select>
  );
}

export default async function EditChecklistPage() {
  const role = await currentRole();
  if (role !== "management") redirect("/shift");

  const items = await prisma.shiftChecklistItem.findMany({
    orderBy: [{ sectionOrder: "asc" }, { sortOrder: "asc" }],
  });

  const bySection = new Map<string, typeof items>();
  for (const i of items) {
    if (!bySection.has(i.section)) bySection.set(i.section, []);
    bySection.get(i.section)!.push(i);
  }
  const orderedSections = SECTIONS.map((s) => s.title).filter((t) => bySection.has(t));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/shift" className="text-sm text-slate-500 hover:underline">← Back to checklist</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Edit checklist</h1>
        <p className="text-sm text-slate-500">
          Management only. Changes apply to the staff checklist immediately. Branch (KL/PJ) and shift control where each item shows.
        </p>
      </div>

      {/* Add item */}
      <form action={createChecklistItem} className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Add item</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
          <div className="sm:col-span-4">
            <label className={lbl}>Label *</label>
            <input name="label" required placeholder="e.g. Wipe the pet weighing scale" className={`${inp} w-full`} />
          </div>
          <div className="sm:col-span-2">
            <label className={lbl}>Section</label>
            <SectionSelect />
          </div>
          <div className="sm:col-span-4">
            <label className={lbl}>Note (optional)</label>
            <input name="note" placeholder="Extra instruction shown under the item" className={`${inp} w-full`} />
          </div>
          <div><label className={lbl}>Shift</label><ShiftSelect /></div>
          <div><label className={lbl}>PJ shift</label><PjShiftSelect /></div>
          <div><label className={lbl}>Priority</label><PrioritySelect /></div>
          <div className="flex items-end gap-3 pb-1.5 sm:col-span-3">
            <label className="flex items-center gap-1.5 text-sm text-slate-600"><input type="checkbox" name="storeKL" defaultChecked /> KL</label>
            <label className="flex items-center gap-1.5 text-sm text-slate-600"><input type="checkbox" name="storePJ" defaultChecked /> PJ</label>
            <div><label className={lbl}>Order</label><input name="sortOrder" type="number" defaultValue={0} className={`${inp} w-16`} /></div>
          </div>
          <div className="flex items-end sm:col-span-3">
            <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">Add item</button>
          </div>
        </div>
      </form>

      {/* Existing items grouped by section */}
      {orderedSections.map((section) => (
        <div key={section} className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-slate-700">{section}</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {bySection.get(section)!.map((it) => (
              <li key={it.id} className={`px-4 py-3 ${it.active ? "" : "bg-slate-50/60"}`}>
                <form action={updateChecklistItem} className="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:items-end">
                  <input type="hidden" name="id" value={it.id} />
                  <div className="sm:col-span-5">
                    <label className={lbl}>Label</label>
                    <input name="label" defaultValue={it.label} className={`${inp} w-full`} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={lbl}>Note</label>
                    <input name="note" defaultValue={it.note ?? ""} className={`${inp} w-full`} />
                  </div>
                  <div className="sm:col-span-2"><label className={lbl}>Section</label><SectionSelect value={it.section} /></div>
                  <div className="sm:col-span-1"><label className={lbl}>Shift</label><ShiftSelect value={it.shift as Scope} /></div>
                  <div className="sm:col-span-1"><label className={lbl}>PJ shift</label><PjShiftSelect value={it.pjShift as Scope | null} /></div>
                  <div className="sm:col-span-1"><label className={lbl}>Priority</label><PrioritySelect value={it.priority as Priority} /></div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:col-span-9">
                    <label className="flex items-center gap-1.5 text-sm text-slate-600"><input type="checkbox" name="storeKL" defaultChecked={it.storeKL} /> KL</label>
                    <label className="flex items-center gap-1.5 text-sm text-slate-600"><input type="checkbox" name="storePJ" defaultChecked={it.storePJ} /> PJ</label>
                    <label className="flex items-center gap-1.5 text-sm text-slate-600"><input type="checkbox" name="active" defaultChecked={it.active} /> Active</label>
                    <span className="flex items-center gap-1"><span className={lbl} style={{ marginBottom: 0 }}>Order</span><input name="sortOrder" type="number" defaultValue={it.sortOrder} className={`${inp} w-16`} /></span>
                  </div>
                  <div className="flex items-center gap-2 sm:col-span-3 sm:justify-end">
                    <button className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800">Save</button>
                  </div>
                </form>
                <form action={deleteChecklistItem} className="mt-1 text-right">
                  <input type="hidden" name="id" value={it.id} />
                  <button className="text-xs text-red-600 hover:underline">Delete</button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
