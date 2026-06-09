"use client";

import { useRef, useState, useTransition } from "react";
import { linkTransaction, searchUnlinkedTransactions } from "./actions";

type Hit = { id: string; label: string };

export default function LinkTransactionForm({ customerId }: { customerId: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Hit[]>([]);
  const [selected, setSelected] = useState<Hit | null>(null);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = (q: string) =>
    startTransition(async () => {
      setResults(await searchUnlinkedTransactions(q));
    });

  const onType = (q: string) => {
    setQuery(q);
    setSelected(null);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => search(q), 300); // debounce
  };

  const openForm = () => {
    setOpen(true);
    search(""); // load most-recent unlinked
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={openForm}
        className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-700"
      >
        + Link a transaction
      </button>
    );
  }

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-3">
      {selected ? (
        <form action={linkTransaction} className="space-y-3">
          <input type="hidden" name="customerId" value={customerId} />
          <input type="hidden" name="transactionId" value={selected.id} />
          <div className="text-sm text-slate-600">Link this transaction:</div>
          <div className="text-sm font-medium text-slate-900 bg-white border border-slate-200 rounded-md px-3 py-2">
            {selected.label}
          </div>
          <div className="flex gap-2 items-center">
            <button className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-700">
              Link transaction
            </button>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-50"
            >
              Change
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-slate-500 text-sm px-2 hover:underline"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <label className="block text-sm font-medium text-slate-700">
            Link an existing transaction
          </label>
          <input
            autoFocus
            value={query}
            onChange={(e) => onType(e.target.value)}
            placeholder="Search by product, amount, receipt # or store…"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
          <div className="max-h-64 overflow-auto divide-y divide-slate-100 bg-white border border-slate-200 rounded-md">
            {pending && <div className="px-3 py-2 text-sm text-slate-400">Searching…</div>}
            {!pending && results.length === 0 && (
              <div className="px-3 py-2 text-sm text-slate-400">No matching unlinked transactions.</div>
            )}
            {!pending &&
              results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelected(r)}
                  className="block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  {r.label}
                </button>
              ))}
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-slate-500 text-sm hover:underline"
          >
            Cancel
          </button>
        </>
      )}
    </div>
  );
}
