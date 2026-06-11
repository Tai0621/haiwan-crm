"use client";

import { useState, useTransition } from "react";
import { runStoreHubTransactionSync } from "@/app/storehub/actions";
import type { StoreHubTransactionSyncSummary } from "@/lib/storehub";

// StoreHub panel for the Transactions page: shows the latest sale on record and
// a button to pull recent sales (already-imported receipts are skipped).
export default function StoreHubSyncShortcut({
  latestSale,
  importedCount,
}: {
  latestSale: string | null;
  importedCount: number;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<StoreHubTransactionSyncSummary | null>(null);

  const run = () =>
    startTransition(async () => {
      setResult(await runStoreHubTransactionSync(7));
    });

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Latest sale on record
          </div>
          <div className="text-lg font-semibold text-slate-900">{latestSale ?? "—"}</div>
          <div className="text-xs text-slate-400">
            {importedCount.toLocaleString()} imported from StoreHub
          </div>
        </div>
        <button
          onClick={run}
          disabled={pending}
          title="Pull the last 7 days of sales from StoreHub (already-imported receipts are skipped)"
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50"
        >
          <svg className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 2v6h6" />
            <path d="M21 12A9 9 0 0 0 6 5.3L3 8" />
            <path d="M21 22v-6h-6" />
            <path d="M3 12a9 9 0 0 0 15 6.7l3-2.7" />
          </svg>
          {pending ? "Syncing from StoreHub…" : "Sync from StoreHub"}
        </button>
      </div>
      {result && (
        <p className={`mt-2 text-xs ${result.ok ? "text-slate-500" : "text-red-600"}`}>
          {result.ok ? (
            <>
              Pulled {result.fetched} sales ·{" "}
              <strong className="text-green-700">{result.created}</strong> new ·{" "}
              {result.skippedDuplicate} already imported · {result.linkedToCustomer} linked to a
              member · lines {result.linesMatched} matched / {result.linesUnmatched} unmatched.
            </>
          ) : (
            <>Sync failed: {result.error}</>
          )}
        </p>
      )}
    </div>
  );
}
