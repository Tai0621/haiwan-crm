import Link from "next/link";
import { prisma } from "@/lib/db";
import { rm, fmtDateTime } from "@/lib/format";
import { STORE_LABELS } from "@/lib/constants";
import AddTransactionForm from "./AddTransactionForm";
import StoreHubSyncShortcut from "./StoreHubSyncShortcut";
import { deleteTransaction } from "./actions";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  // Only the recent list is needed to render the page. The product catalogue and
  // customer list for the "Add transaction" form are loaded on demand when the
  // form is opened (see AddTransactionForm lazy mode) so this page stays fast.
  const [transactions, importedCount, lastSale] = await Promise.all([
    prisma.transaction.findMany({
      orderBy: { transactionDate: "desc" },
      take: 100,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        _count: { select: { lines: true } },
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
        <h2 className="text-lg font-semibold mb-3">
          Recent ({transactions.length}
          {transactions.length === 100 ? "+" : ""})
        </h2>
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
                  <td className="py-2 text-right text-slate-500 tabular-nums">{t._count.lines}</td>
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
                      <button
                        className="text-xs text-red-600 hover:underline"
                        aria-label="Delete transaction"
                      >
                        Delete
                      </button>
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
