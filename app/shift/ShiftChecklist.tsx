"use client";

import { useMemo, useState, useTransition } from "react";
import { buildSections, type Shift, type SopItem } from "@/lib/shift-checklist";
import { submitShiftLog } from "./actions";

const PRIORITY_BORDER: Record<string, string> = {
  high: "border-l-red-400",
  med: "border-l-amber-400",
  low: "border-l-emerald-400",
};

const input = "rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:border-slate-400 focus:outline-none";
const labelCls = "block text-xs font-medium text-slate-500 mb-1";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ShiftChecklist({ items }: { items: SopItem[] }) {
  const [shift, setShift] = useState<Shift>("OPENING");
  const [store, setStore] = useState<"KL" | "PJ">("KL");
  const [staffName, setStaffName] = useState("");
  const [date, setDate] = useState(todayISO());
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [remarks, setRemarks] = useState("");
  const [supervisor, setSupervisor] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sections = useMemo(() => buildSections(items, shift, store), [items, shift, store]);
  const itemIds = useMemo(() => sections.flatMap((s) => s.items.map((i) => i.id)), [sections]);
  const total = itemIds.length;
  const done = itemIds.filter((id) => checked.has(id)).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSaved(null);
  }

  function switchShift(s: Shift) {
    setShift(s);
    setSaved(null);
  }

  function signOff() {
    setError(null);
    if (!staffName.trim()) {
      setError("Enter your name before signing off.");
      return;
    }
    const checkedItems = itemIds.filter((id) => checked.has(id));
    startTransition(async () => {
      try {
        await submitShiftLog({
          shift,
          store,
          businessDate: date,
          staffName,
          checkedItems,
          itemsTotal: total,
          remarks,
          supervisorName: supervisor,
        });
        setSaved(`${shift === "OPENING" ? "Opening" : "Closing"} signed off — ${done}/${total} done.`);
        setChecked(new Set());
        setRemarks("");
        setSupervisor("");
      } catch {
        setError("Couldn't save. Try again.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Shift toggle */}
      <div className="flex overflow-hidden rounded-lg border border-slate-200">
        {(["OPENING", "CLOSING"] as const).map((s) => (
          <button
            key={s}
            onClick={() => switchShift(s)}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              shift === s ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {s === "OPENING" ? "Opening shift" : "Closing shift"}
          </button>
        ))}
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className={labelCls}>Branch</label>
          <select value={store} onChange={(e) => setStore(e.target.value as "KL" | "PJ")} className={`${input} w-full`}>
            <option value="KL">KL</option>
            <option value="PJ">PJ</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${input} w-full`} />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Your name *</label>
          <input value={staffName} onChange={(e) => setStaffName(e.target.value)} placeholder="Staff on shift" className={`${input} w-full`} />
        </div>
      </div>

      {/* Progress */}
      <div>
        <div className="mb-1 flex justify-between text-xs">
          <span className="font-medium text-slate-600">Completion</span>
          <span className="text-slate-500">{done} / {total} items · {pct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Sections */}
      {sections.map((section) => {
        const sDone = section.items.filter((i) => checked.has(i.id)).length;
        return (
          <div key={section.section} className="rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <h3 className="text-sm font-semibold text-slate-700">{section.section}</h3>
              <span className="text-xs text-slate-400">{sDone}/{section.items.length}</span>
            </div>
            <ul className="divide-y divide-slate-50">
              {section.items.map((item) => {
                const on = checked.has(item.id);
                return (
                  <li
                    key={item.id}
                    onClick={() => toggle(item.id)}
                    className={`flex cursor-pointer items-start gap-3 border-l-4 px-4 py-2.5 ${PRIORITY_BORDER[item.priority]} ${on ? "bg-emerald-50/60" : "hover:bg-slate-50"}`}
                  >
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${on ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white"}`}>
                      {on && (
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className={`text-sm ${on ? "text-slate-400 line-through" : "text-slate-700"}`}>{item.label}</div>
                      {item.note && <div className="text-xs text-slate-400">{item.note}</div>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      {/* Remarks + sign-off */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <label className={labelCls}>Remarks / issues to flag for next shift</label>
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={2}
          placeholder="e.g. Left window corner needs a stronger cleaner. Bin liner stock running low."
          className={`${input} w-full`}
        />
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Checked by (supervisor)</label>
            <input value={supervisor} onChange={(e) => setSupervisor(e.target.value)} placeholder="Optional" className={`${input} w-full`} />
          </div>
          <div className="flex items-end">
            <button
              onClick={signOff}
              disabled={pending}
              className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Sign off & save"}
            </button>
          </div>
        </div>
        {saved && <p className="mt-2 text-sm text-emerald-600">{saved}</p>}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
