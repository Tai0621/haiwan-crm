"use client";

import { useState, useTransition } from "react";
import { runWixSync } from "./actions";
import type { WixSyncSummary } from "@/lib/wix";

export default function SyncButton({ disabled }: { disabled?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<WixSyncSummary | null>(null);
  const [showUnmatched, setShowUnmatched] = useState(false);

  const run = () =>
    startTransition(async () => {
      setResult(await runWixSync());
    });

  return (
    <div className="space-y-3">
      <button
        onClick={run}
        disabled={pending || disabled}
        className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
      >
        {pending ? "Syncing from Wix…" : "Sync inventory from Wix"}
      </button>

      {result && (
        <div
          className={`rounded-md border p-3 text-sm ${
            result.ok ? "border-slate-200 bg-slate-50" : "border-red-200 bg-red-50"
          }`}
        >
          {!result.ok ? (
            <p className="text-red-700">Sync failed: {result.error}</p>
          ) : (
            <>
              <p className="text-slate-800">
                Synced <strong>{result.updated}</strong> products from{" "}
                <strong>{result.wixProductCount}</strong> in Wix.
                {result.unmatched.length > 0 && (
                  <>
                    {" "}
                    <span className="text-amber-700">
                      {result.unmatched.length} not matched
                    </span>
                    {result.ambiguous.length > 0 && (
                      <span className="text-amber-700">
                        , {result.ambiguous.length} ambiguous
                      </span>
                    )}
                    .
                  </>
                )}
              </p>
              {result.unmatched.length > 0 && (
                <div className="mt-2">
                  <button
                    onClick={() => setShowUnmatched((s) => !s)}
                    className="text-xs text-slate-500 underline"
                  >
                    {showUnmatched ? "Hide" : "Show"} unmatched Wix products
                  </button>
                  {showUnmatched && (
                    <ul className="mt-1 max-h-48 overflow-auto text-xs text-slate-600 list-disc pl-5">
                      {result.unmatched.map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                      {result.ambiguous.map((n, i) => (
                        <li key={`a${i}`} className="text-amber-600">
                          {n} (ambiguous — name matched an already-synced product)
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <p className="text-xs text-slate-400 mt-1">
                Tip: rename an unmatched Wix product (or its CRM product) to match exactly, then
                re-sync — the link is remembered afterwards.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
