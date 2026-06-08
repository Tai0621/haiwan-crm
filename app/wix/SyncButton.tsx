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
                Updated <strong>{result.updated}</strong> products
                {result.created > 0 && (
                  <>
                    {" "}
                    and created <strong>{result.created}</strong> new
                  </>
                )}{" "}
                from <strong>{result.unitCount}</strong> Wix variants ({result.wixProductCount} Wix
                products).
                {result.unmatched.length > 0 && (
                  <>
                    {" "}
                    <span className="text-amber-700">
                      {result.unmatched.length} need a name aligned
                    </span>
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
                    {showUnmatched ? "Hide" : "Show"} unmatched Wix items
                  </button>
                  {showUnmatched && (
                    <ul className="mt-1 max-h-48 overflow-auto text-xs text-slate-600 list-disc pl-5">
                      {result.unmatched.map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <p className="text-xs text-slate-400 mt-1">
                Tip: rename an unmatched Wix item (or its CRM product) so the names match, then
                re-sync — the link is remembered afterwards.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
