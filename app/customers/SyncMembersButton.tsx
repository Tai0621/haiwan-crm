"use client";

import { useState, useTransition } from "react";
import { runStoreHubCustomerSync } from "@/app/storehub/actions";
import type { StoreHubCustomerSyncSummary } from "@/lib/storehub";

// Pulls the StoreHub membership list into the CRM (upserts by phone). The daily
// cron does this automatically; this is the manual trigger.
export default function SyncMembersButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<StoreHubCustomerSyncSummary | null>(null);

  const run = () =>
    startTransition(async () => {
      setResult(await runStoreHubCustomerSync());
    });

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={run}
        disabled={pending}
        title="Pull the StoreHub member list into the CRM (matched by phone)"
        className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        <svg className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 2v6h6" />
          <path d="M21 12A9 9 0 0 0 6 5.3L3 8" />
          <path d="M21 22v-6h-6" />
          <path d="M3 12a9 9 0 0 0 15 6.7l3-2.7" />
        </svg>
        {pending ? "Syncing members…" : "Sync members"}
      </button>
      {result && (
        <p className={`text-xs ${result.ok ? "text-slate-500" : "text-red-600"}`}>
          {result.ok ? (
            <>
              <strong className="text-green-700">{result.created}</strong> new · {result.updated}{" "}
              enriched · {result.total} members
            </>
          ) : (
            <>Failed: {result.error}</>
          )}
        </p>
      )}
    </div>
  );
}
