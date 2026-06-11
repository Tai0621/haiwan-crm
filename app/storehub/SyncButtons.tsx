"use client";

import { useState, useTransition } from "react";
import { runStoreHubTransactionSync, runStoreHubCustomerSync } from "./actions";
import type {
  StoreHubTransactionSyncSummary,
  StoreHubCustomerSyncSummary,
} from "@/lib/storehub";

export default function SyncButtons({ disabled }: { disabled?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"txn" | "cust" | null>(null);
  const [txn, setTxn] = useState<StoreHubTransactionSyncSummary | null>(null);
  const [cust, setCust] = useState<StoreHubCustomerSyncSummary | null>(null);
  const [days, setDays] = useState(7);

  const syncTxns = () =>
    startTransition(async () => {
      setBusy("txn");
      try {
        setTxn(await runStoreHubTransactionSync(days));
      } finally {
        setBusy(null);
      }
    });

  const syncCusts = () =>
    startTransition(async () => {
      setBusy("cust");
      try {
        setCust(await runStoreHubCustomerSync());
      } finally {
        setBusy(null);
      }
    });

  return (
    <div className="space-y-6">
      {/* Transactions */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={syncTxns}
            disabled={pending || disabled}
            className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
          >
            {busy === "txn" ? "Syncing sales…" : "Sync transactions"}
          </button>
          <label className="text-sm text-slate-500">
            last{" "}
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              disabled={pending}
              className="border border-slate-300 rounded-md px-2 py-1 text-sm bg-white"
            >
              <option value={3}>3 days</option>
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </label>
        </div>
        {txn && (
          <div
            className={`rounded-md border p-3 text-sm ${
              txn.ok ? "border-slate-200 bg-slate-50" : "border-red-200 bg-red-50"
            }`}
          >
            {!txn.ok ? (
              <p className="text-red-700">Sync failed: {txn.error}</p>
            ) : (
              <p className="text-slate-800">
                Pulled <strong>{txn.fetched}</strong> sales (last {txn.days} days) ·{" "}
                <strong className="text-green-700">{txn.created}</strong> new ·{" "}
                {txn.skippedDuplicate} already imported · {txn.skippedCancelled} skipped ·{" "}
                {txn.linkedToCustomer} linked to a member · lines {txn.linesMatched} matched /{" "}
                {txn.linesUnmatched} unmatched.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Customers / members */}
      <div className="space-y-2">
        <button
          onClick={syncCusts}
          disabled={pending || disabled}
          className="bg-white border border-slate-300 text-slate-800 px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          {busy === "cust" ? "Syncing members…" : "Sync members"}
        </button>
        {cust && (
          <div
            className={`rounded-md border p-3 text-sm ${
              cust.ok ? "border-slate-200 bg-slate-50" : "border-red-200 bg-red-50"
            }`}
          >
            {!cust.ok ? (
              <p className="text-red-700">Sync failed: {cust.error}</p>
            ) : (
              <p className="text-slate-800">
                {cust.total} StoreHub members ·{" "}
                <strong className="text-green-700">{cust.created}</strong> new ·{" "}
                {cust.updated} enriched · {cust.skippedNoPhone} without a phone.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
