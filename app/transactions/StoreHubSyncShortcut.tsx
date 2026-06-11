"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { runStoreHubTransactionSync } from "@/app/storehub/actions";
import type { StoreHubTransactionSyncSummary } from "@/lib/storehub";

// Compact "pull recent sales from StoreHub" button for the Transactions page.
// The full controls (window length, member sync, status) live on /storehub.
export default function StoreHubSyncShortcut() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<StoreHubTransactionSyncSummary | null>(null);

  const run = () =>
    startTransition(async () => {
      setResult(await runStoreHubTransactionSync(7));
    });

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button
        onClick={run}
        disabled={pending}
        title="Pull the last 7 days of sales from StoreHub (already-imported receipts are skipped)"
        className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
      >
        <svg className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 2v6h6" />
          <path d="M21 12A9 9 0 0 0 6 5.3L3 8" />
          <path d="M21 22v-6h-6" />
          <path d="M3 12a9 9 0 0 0 15 6.7l3-2.7" />
        </svg>
        {pending ? "Syncing from StoreHub…" : "Sync from StoreHub"}
      </button>
      {result && (
        <p className={`text-xs ${result.ok ? "text-slate-500" : "text-red-600"}`}>
          {result.ok ? (
            <>
              <strong className="text-green-700">{result.created}</strong> new ·{" "}
              {result.skippedDuplicate} already imported · {result.linkedToCustomer} linked.{" "}
              <Link href="/storehub" className="underline">
                More
              </Link>
            </>
          ) : (
            <>Sync failed: {result.error}</>
          )}
        </p>
      )}
    </div>
  );
}
