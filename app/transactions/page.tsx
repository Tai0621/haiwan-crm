import Link from "next/link";
import { prisma } from "@/lib/db";
import { rm, fmtDateTime } from "@/lib/format";
import { STORE_LABELS } from "@/lib/constants";
import AddTransactionForm from "./AddTransactionForm";
import StoreHubSyncShortcut from "./StoreHubSyncShortcut";
import SubmitButton from "@/app/components/SubmitButton";
import { deleteTransaction } from "./actions";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  // Only the recent list is needed to render the page. The product catalogue and
  // customer list for the "Add transaction" form are loaded on demand when the
  // form is opened (see AddTransactionForm lazy mode) so this page stays fast.
  const [transactions, importedCount, lastSale] = await Promise.all([
    prisma.transaction.findMany({
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
      take: 100,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        lines: { select: { quantity: true, rawProductName: true, product: { select: { name: true } } } },
      },
    }),
    prisma.transaction.count({ where: { storehubRef: { not: null } } }),
    prisma.transaction.findFirst({
      where: { storehubRef: { not: null } },
      orderBy: { transactionDate: "desc" },
      select: { transactionDate: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Transactions</h1>
        <p className="text-sm text-slate-500 mt-1">
          Record an in-store sale and link it to a customer. (Bulk history still comes in via{" "}
          <Link href="/import" className="underline">
            Import
          </Link>
          .)
        </p>
      </div>

      <StoreHubSyncShortcut
        latestSale={lastSale?.transactionDate ? fmtDateTime(lastSale.transactionDate) : null}
        importedCount={importedCount}
      />

      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <AddTransactionForm lazy returnTo="/transactions" />
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-lg font-semibold">
            Recent ({transactions.length}
            {transactions.length === 100 ? "+" : ""})
          </h2>
          <a
            href="/export/transactions-xlsx"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            <svg className="h-4 w-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3" /><path d="m8 11 4 4 4-4" /><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /></svg>
            Export to Excel
          </a>
        </div>
        {transactions.length === 0 ? (
          <p className="text-sm text-slate-400">No transactions yet.</p>
        ) : (
         <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="text-slate-400 text-left text-xs border-b border-slate-100">
              <tr>
                <th className="py-2 font-medium">Date</th>
                <th className="py-2 font-medium">Customer</th>
                <th className="py-2 font-medium">Store</th>
                <th className="py-2 font-medium">Products</th>
                <th className="py-2 font-medium text-right">Items</th>
                <th className="py-2 font-medium text-right">Total</th>
                <th className="py-2 font-medium text-right">Source</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td className="py-2 text-slate-700 whitespace-nowrap">
                    {fmtDateTime(t.transactionDate)}
                  </td>
                  <td className="py-2 text-slate-700">
                    {t.customer ? (
                      <Link href={`/customers/${t.customer.id}`} className="hover:underline">
                        {t.customer.name ?? t.customer.phone}
                      </Link>
                    ) : (
                      <span className="text-slate-400 italic">Unlinked</span>
                    )}
                  </td>
                  <td className="py-2 text-slate-600">{STORE_LABELS[t.store]}</td>
                  <td className="py-2 text-slate-600 max-w-[22rem]">
                    {t.lines.length === 0 ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      (() => {
                        const names = t.lines.map((l) => l.product?.name ?? l.rawProductName);
                        const shown = names.slice(0, 2).join(", ");
                        const extra = names.length - 2;
                        return (
                          <span className="block truncate" title={names.join(", ")}>
                            {shown}
                            {extra > 0 && <span className="text-slate-400"> +{extra} more</span>}
                          </span>
                        );
                      })()
                    )}
                  </td>
                  <td className="py-2 text-right text-slate-500 tabular-nums">{t.lines.length}</td>
                  <td className="py-2 text-right text-slate-800 tabular-nums">{rm(t.totalAmount)}</td>
                  <td className="py-2 text-right">
                    <span className="text-[10px] uppercase tracking-wide text-slate-400">
                      {t.storehubRef ? "import" : "manual"}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <form action={deleteTransaction}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="returnTo" value="/transactions" />
                      <SubmitButton
                        className="text-xs text-red-600 hover:underline"
                        aria-label="Delete transaction"
                        pendingText="Deleting…"
                      >
                        Delete
                      </SubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
         </div>
        )}
      </div>
    </div>
  );
}
