"use client";

import { useMemo, useState } from "react";
import { linkTransaction } from "./actions";

export type UnlinkedTxn = { id: string; label: string };

export default function LinkTransactionForm({
  customerId,
  unlinked,
}: {
  customerId: string;
  unlinked: UnlinkedTxn[];
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  const byLabel = useMemo(() => new Map(unlinked.map((t) => [t.label, t.id])), [unlinked]);
  const selectedId = byLabel.get(value) ?? "";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-700"
      >
        + Link a transaction
      </button>
    );
  }

  if (unlinked.length === 0) {
    return (
      <div className="text-sm text-slate-500 border border-slate-200 rounded-lg p-3 bg-slate-50">
        No unlinked transactions available.{" "}
        <button type="button" onClick={() => setOpen(false)} className="underline">
          Close
        </button>
      </div>
    );
  }

  return (
    <form
      action={linkTransaction}
      className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-3"
    >
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="transactionId" value={selectedId} />
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Link an existing transaction
        </label>
        <input
          list="unlinked-txns"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search by date, store, amount or product…"
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
        />
        <datalist id="unlinked-txns">
          {unlinked.map((t) => (
            <option key={t.id} value={t.label} />
          ))}
        </datalist>
        {value && !selectedId && (
          <span className="text-[11px] text-amber-600">Pick a transaction from the list.</span>
        )}
        <p className="text-xs text-slate-400 mt-1">
          {unlinked.length} unlinked transaction{unlinked.length === 1 ? "" : "s"} available.
        </p>
      </div>
      <div className="flex gap-2">
        <button
          disabled={!selectedId}
          className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
        >
          Link transaction
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
