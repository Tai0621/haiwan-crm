"use client";

import { useState, useTransition } from "react";
import { receiveAndApply } from "./actions";
import type { StockUpdateItem } from "@/lib/inventory";

// Receive & check: count the physical goods against a restock list before it's
// applied. Counted quantities win — variances become discrepancies + a
// follow-up task. Inputs are prefilled with the listed qty so the happy path
// (everything matches) is confirm-and-done.
export default function ReceiveCheckForm({ updateId, items }: { updateId: string; items: StockUpdateItem[] }) {
  const restockIndexes = items.map((it, i) => ({ it, i })).filter(({ it }) => it.action === "restock");

  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Record<number, string>>(
    () => Object.fromEntries(restockIndexes.map(({ it, i }) => [i, String(it.qty)])),
  );
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [checkedBy, setCheckedBy] = useState("");
  const [result, setResult] = useState<{ ok: boolean; discrepancies?: number; error?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const anyVariance = restockIndexes.some(({ it, i }) => parseInt(counts[i] ?? "", 10) !== it.qty);

  function submit() {
    if (pending) return;
    if (!checkedBy.trim()) {
      setResult({ ok: false, error: "Enter who checked the goods." });
      return;
    }
    const payload = restockIndexes.map(({ i }) => ({
      index: i,
      receivedQty: parseInt(counts[i] ?? "0", 10) || 0,
      note: notes[i]?.trim() || null,
    }));
    startTransition(async () => {
      const r = await receiveAndApply(updateId, payload, checkedBy);
      setResult(r);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
      >
        Receive &amp; check
      </button>
    );
  }

  return (
    <div className="mt-2 w-full rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="mb-2 text-xs text-slate-500">
        Count the physical goods for each line. Counted numbers are what gets added to stock; any difference from the
        list is logged and a follow-up task is raised.
      </p>
      <table className="w-full text-sm">
        <thead className="text-left text-[11px] text-slate-400">
          <tr>
            <th className="py-1 pr-2 font-medium">Product</th>
            <th className="py-1 pr-2 font-medium">Store</th>
            <th className="py-1 pr-2 font-medium text-right">Listed</th>
            <th className="py-1 pr-2 font-medium">Counted</th>
            <th className="py-1 font-medium">Note (damage, wrong item…)</th>
          </tr>
        </thead>
        <tbody>
          {restockIndexes.map(({ it, i }) => {
            const counted = parseInt(counts[i] ?? "", 10);
            const varies = Number.isFinite(counted) && counted !== it.qty;
            return (
              <tr key={i}>
                <td className="py-1 pr-2 text-slate-700">{it.productName}</td>
                <td className="py-1 pr-2 text-slate-500">{it.store}</td>
                <td className="py-1 pr-2 text-right text-slate-500">{it.qty}</td>
                <td className="py-1 pr-2">
                  <input
                    type="number"
                    min={0}
                    value={counts[i] ?? ""}
                    onChange={(e) => setCounts((p) => ({ ...p, [i]: e.target.value }))}
                    className={`w-20 rounded-md border px-2 py-1 text-sm focus:outline-none ${varies ? "border-amber-400 bg-amber-50 text-amber-800" : "border-slate-200"}`}
                  />
                </td>
                <td className="py-1">
                  <input
                    value={notes[i] ?? ""}
                    onChange={(e) => setNotes((p) => ({ ...p, [i]: e.target.value }))}
                    placeholder={varies ? "Why the difference?" : ""}
                    className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm focus:outline-none"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {items.some((it) => it.action !== "restock") && (
        <p className="mt-1 text-[11px] text-slate-400">Transfer / stock-take lines in this update are applied as listed.</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={checkedBy}
          onChange={(e) => setCheckedBy(e.target.value)}
          placeholder="Checked by *"
          className="w-40 rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:border-slate-400 focus:outline-none"
        />
        <button
          onClick={submit}
          disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "Applying…" : anyVariance ? "Apply counted quantities" : "Confirm — all match"}
        </button>
        <button onClick={() => setOpen(false)} className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
          Cancel
        </button>
        {result && !result.ok && <span className="text-sm text-red-600">{result.error}</span>}
        {result?.ok && (
          <span className="text-sm text-emerald-600">
            Applied{result.discrepancies ? ` — ${result.discrepancies} discrepanc${result.discrepancies === 1 ? "y" : "ies"} logged + follow-up task raised` : " — all matched"}.
          </span>
        )}
      </div>
    </div>
  );
}
