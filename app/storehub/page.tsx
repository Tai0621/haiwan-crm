import { prisma } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { storeHubConfigured } from "@/lib/storehub";
import SyncButtons from "./SyncButtons";

export const dynamic = "force-dynamic";

export default async function StoreHubPage() {
  const configured = storeHubConfigured();

  const [importedTxns, lastTxn, storehubCustomers] = await Promise.all([
    prisma.transaction.count({ where: { storehubRef: { not: null } } }),
    prisma.transaction.findFirst({
      where: { storehubRef: { not: null } },
      orderBy: { transactionDate: "desc" },
      select: { transactionDate: true },
    }),
    prisma.customer.count({ where: { source: "STOREHUB" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">StoreHub</h1>
        <p className="text-sm text-slate-500 mt-1">
          StoreHub is the source of truth for <strong>sales</strong> and the{" "}
          <strong>membership</strong> list. Inventory comes from Wix (see Products). Syncs are
          incremental and safe to re-run — already-imported receipts are skipped.
        </p>
      </div>

      {!configured && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <strong>StoreHub not configured.</strong> Set <code>STOREHUB_API_USERNAME</code> and{" "}
          <code>STOREHUB_API_PASSWORD</code> in the environment to enable syncing.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Transactions imported" value={importedTxns.toLocaleString()} />
        <Stat
          label="Latest sale on record"
          value={lastTxn?.transactionDate ? fmtDateTime(lastTxn.transactionDate) : "—"}
        />
        <Stat label="Members in CRM" value={storehubCustomers.toLocaleString()} />
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-1">Sync now</h2>
        <p className="text-sm text-slate-500 mb-4">
          Pull recent sales (and optionally refresh the member list) from StoreHub into the CRM.
          A scheduled daily sync keeps things current automatically.
        </p>
        <SyncButtons disabled={!configured} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-xl font-semibold text-slate-900 mt-1">{value}</div>
    </div>
  );
}
