import Link from "next/link";
import { prisma } from "@/lib/db";
import { currentRole } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { lowStockThreshold, stockSummary, parseItems, updateProblems } from "@/lib/inventory";
import Pagination from "@/app/components/Pagination";
import PasteStockForm from "./PasteStockForm";
import ReceiveCheckForm from "./ReceiveCheckForm";
import {
  applyUpdate,
  dismissUpdate,
  manualRestock,
  manualTransfer,
  manualSetCount,
  setLowStockThreshold,
} from "./actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const inp = "rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:border-slate-400 focus:outline-none";
const lbl = "block text-[11px] font-medium text-slate-500 mb-0.5";

const MOVEMENT_STYLES: Record<string, string> = {
  RESTOCK: "bg-emerald-100 text-emerald-700",
  TRANSFER: "bg-blue-100 text-blue-700",
  SALE: "bg-slate-100 text-slate-600",
  ADJUSTMENT: "bg-amber-100 text-amber-700",
};

type SearchParams = Promise<{ q?: string; brand?: string; low?: string; page?: string }>;

export default async function InventoryPage({ searchParams }: { searchParams: SearchParams }) {
  const { q, brand, low, page: pageParam } = await searchParams;
  const role = await currentRole();
  const threshold = await lowStockThreshold();

  const where: Record<string, unknown> = {};
  if (q && q.trim()) {
    const term = q.trim();
    where.OR = [{ name: { contains: term } }, { sku: { contains: term } }, { brand: { contains: term } }];
  }
  if (brand && brand !== "ALL") where.brandId = brand;

  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const [summary, brands, pending, allMatching, movements, discrepancies] = await Promise.all([
    stockSummary(threshold),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.stockUpdate.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" } }),
    prisma.product.findMany({
      where,
      orderBy: [{ brand: "asc" }, { name: "asc" }],
      select: {
        id: true, name: true, sku: true, brand: true,
        stockKL: true, stockPJ: true, wixStock: true,
      },
    }),
    prisma.stockMovement.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { product: { select: { name: true } } },
    }),
    role === "management"
      ? prisma.stockDiscrepancy.findMany({ orderBy: { createdAt: "desc" }, take: 20 })
      : Promise.resolve([]),
  ]);

  // Low-stock filter is computed (KL+PJ), so filter after the query.
  const filtered = low === "1" ? allMatching.filter((p) => p.stockKL + p.stockPJ <= threshold) : allMatching;
  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const params = { q, brand, low };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Inventory</h1>
        <p className="text-sm text-slate-500">
          Centralized per-store stock — counts move only through the ledger (sales deduct automatically;
          restocks &amp; transfers via the stock message or the quick forms).
        </p>
      </div>

      {/* Tiles */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Tile label="Products" value={summary.totalSkus} />
        <Tile label={`Low stock (≤ ${threshold})`} value={summary.low} accent={summary.low ? "amber" : undefined} />
        <Tile label="Out of stock" value={summary.out} accent={summary.out ? "red" : undefined} />
        <Tile label="Pending updates" value={summary.pendingUpdates} accent={summary.pendingUpdates ? "blue" : undefined} />
      </div>

      {/* Pending updates */}
      {pending.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-white">
          <div className="border-b border-blue-100 bg-blue-50 px-4 py-3">
            <h2 className="text-lg font-semibold text-slate-900">Pending stock updates</h2>
            <p className="text-xs text-slate-500">Parsed from stock messages — review, then apply.</p>
          </div>
          <ul className="divide-y divide-slate-100">
            {pending.map((u) => {
              const items = parseItems(u.itemsJson);
              const problems = updateProblems(items);
              const hasRestock = items.some((it) => it.action === "restock");
              return (
                <li key={u.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-800">{u.summary ?? "Stock update"}</div>
                      <div className="text-xs text-slate-400">
                        {u.source === "WHATSAPP" ? `WhatsApp${u.phone ? ` · ${u.phone}` : ""}` : "Pasted"} · {fmtDateTime(u.createdAt)}
                      </div>
                      <p className="mt-1 max-w-2xl whitespace-pre-wrap font-mono text-xs text-slate-500">{u.rawText}</p>
                      <table className="mt-2 text-sm">
                        <tbody>
                          {items.map((it, i) => (
                            <tr key={i}>
                              <td className="pr-3 py-0.5">
                                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${it.action === "restock" ? "bg-emerald-100 text-emerald-700" : it.action === "transfer" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                                  {it.action}
                                </span>
                              </td>
                              <td className={`pr-3 py-0.5 ${it.productId ? "text-slate-700" : "text-red-600"}`}>
                                {it.productName}{!it.productId && " (no match)"}
                              </td>
                              <td className="pr-3 py-0.5 text-slate-600">
                                {it.action === "transfer"
                                  ? `${it.qty} · ${it.fromStore ?? "?"} → ${it.toStore ?? "?"}`
                                  : it.action === "set"
                                    ? `set ${it.store ?? "?"} to ${it.qty}`
                                    : `+${it.qty} at ${it.store ?? "?"}`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {problems.length > 0 && (
                        <p className="mt-1 text-xs text-amber-700">
                          Can&apos;t apply yet: {problems.join(" ")} Re-send the message with more detail, or use the quick forms.
                        </p>
                      )}
                      {u.error && problems.length === 0 && <p className="mt-1 text-xs text-red-600">{u.error}</p>}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {problems.length === 0 && !hasRestock && (
                        <form action={applyUpdate}>
                          <input type="hidden" name="id" value={u.id} />
                          <button className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">Apply</button>
                        </form>
                      )}
                      <form action={dismissUpdate}>
                        <input type="hidden" name="id" value={u.id} />
                        <button className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">Dismiss</button>
                      </form>
                    </div>
                  </div>
                  {/* Restock lists must be received & checked against the physical goods. */}
                  {problems.length === 0 && hasRestock && (
                    <div className="mt-2">
                      <ReceiveCheckForm updateId={u.id} items={items} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <PasteStockForm />

      {/* Quick manual actions */}
      <details className="rounded-lg border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">Quick actions — restock · transfer{role === "management" ? " · stock take" : ""}</summary>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <form action={manualRestock} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Restock (goods in)</h3>
            <div><label className={lbl}>Product (name or SKU)</label><input name="product" required className={`${inp} w-full`} /></div>
            <div className="flex gap-2">
              <div><label className={lbl}>Store</label><select name="store" className={inp}><option>KL</option><option>PJ</option></select></div>
              <div><label className={lbl}>Qty</label><input name="qty" type="number" min={1} required className={`${inp} w-20`} /></div>
              <div className="flex-1"><label className={lbl}>Note</label><input name="note" className={`${inp} w-full`} /></div>
            </div>
            <button className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">Restock</button>
          </form>

          <form action={manualTransfer} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-blue-700">Transfer between stores</h3>
            <div><label className={lbl}>Product (name or SKU)</label><input name="product" required className={`${inp} w-full`} /></div>
            <div className="flex gap-2">
              <div><label className={lbl}>From</label><select name="fromStore" className={inp}><option>KL</option><option>PJ</option></select></div>
              <div><label className={lbl}>To</label><select name="toStore" className={inp} defaultValue="PJ"><option>KL</option><option>PJ</option></select></div>
              <div><label className={lbl}>Qty</label><input name="qty" type="number" min={1} required className={`${inp} w-20`} /></div>
              <div className="flex-1"><label className={lbl}>Note</label><input name="note" className={`${inp} w-full`} /></div>
            </div>
            <button className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">Transfer</button>
          </form>

          {role === "management" && (
            <form action={manualSetCount} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-700">Stock take (set count)</h3>
              <div><label className={lbl}>Product (name or SKU)</label><input name="product" required className={`${inp} w-full`} /></div>
              <div className="flex gap-2">
                <div><label className={lbl}>Store</label><select name="store" className={inp}><option>KL</option><option>PJ</option></select></div>
                <div><label className={lbl}>Counted</label><input name="count" type="number" min={0} required className={`${inp} w-24`} /></div>
                <div className="flex-1"><label className={lbl}>Note</label><input name="note" className={`${inp} w-full`} /></div>
              </div>
              <button className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">Set count</button>
            </form>
          )}

          {role === "management" && (
            <form action={setLowStockThreshold} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Low-stock threshold</h3>
              <div className="flex items-end gap-2">
                <div><label className={lbl}>Highlight at ≤</label><input name="threshold" type="number" min={0} defaultValue={threshold} className={`${inp} w-24`} /></div>
                <button className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">Save</button>
              </div>
            </form>
          )}
        </div>
      </details>

      {/* Catalog */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Stock by product</h2>
          <form method="get" className="flex flex-wrap items-center gap-2 text-sm">
            <input name="q" defaultValue={q ?? ""} placeholder="Search name / SKU / brand" className={`${inp} w-52`} />
            <select name="brand" defaultValue={brand ?? "ALL"} className={inp}>
              <option value="ALL">All brands</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-slate-600">
              <input type="checkbox" name="low" value="1" defaultChecked={low === "1"} /> Low stock only
            </label>
            <button className="rounded-md border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50">Filter</button>
          </form>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 font-medium">Brand</th>
                <th className="px-3 py-2 font-medium text-right">KL</th>
                <th className="px-3 py-2 font-medium text-right">PJ</th>
                <th className="px-3 py-2 font-medium text-right">Total</th>
                <th className="px-3 py-2 font-medium text-right">Wix ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((p) => {
                const total = p.stockKL + p.stockPJ;
                const cell = (n: number) =>
                  n <= 0 ? "font-medium text-red-600" : n <= threshold ? "font-medium text-amber-600" : "text-slate-700";
                const drift = p.wixStock != null && p.wixStock !== total;
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <span className="text-slate-800">{p.name}</span>
                      <span className="ml-2 font-mono text-xs text-slate-400">{p.sku}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-500">{p.brand ?? "—"}</td>
                    <td className={`px-3 py-2 text-right ${cell(p.stockKL)}`}>{p.stockKL}</td>
                    <td className={`px-3 py-2 text-right ${cell(p.stockPJ)}`}>{p.stockPJ}</td>
                    <td className={`px-3 py-2 text-right font-medium ${total <= 0 ? "text-red-600" : total <= threshold ? "text-amber-600" : "text-slate-900"}`}>{total}</td>
                    <td className="px-3 py-2 text-right text-xs">
                      {p.wixStock == null ? <span className="text-slate-300">—</span> : (
                        <span className={drift ? "text-amber-600" : "text-slate-400"} title={drift ? "Differs from KL+PJ — worth a stock take" : "Matches KL+PJ"}>
                          {p.wixStock}{drift ? " ≠" : ""}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No products match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 pb-3">
          <Pagination basePath="/inventory" params={params} page={page} totalPages={totalPages} totalCount={totalCount} />
        </div>
      </div>

      {/* Recent movements */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">Recent movements</h2>
          <p className="text-xs text-slate-400">The ledger — every stock change and where it came from.</p>
        </div>
        {movements.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400">No movements yet.</p>
        ) : (
          <ul className="divide-y divide-slate-50 text-sm">
            {movements.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${MOVEMENT_STYLES[m.type] ?? "bg-slate-100 text-slate-600"}`}>{m.type}</span>
                <span className="text-slate-700">{m.product?.name ?? "(deleted product)"}</span>
                <span className={`font-medium ${m.delta >= 0 ? "text-emerald-600" : "text-red-600"}`}>{m.delta >= 0 ? `+${m.delta}` : m.delta}</span>
                <span className="text-slate-500">at {m.store}</span>
                {m.note && <span className="text-xs text-slate-400">· {m.note}</span>}
                <span className="ml-auto text-xs text-slate-400">{fmtDateTime(m.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Receiving discrepancies (management) — supplier reliability / shrinkage trail */}
      {role === "management" && (
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-lg font-semibold text-slate-900">Receiving discrepancies</h2>
            <p className="text-xs text-slate-400">
              Where the physical count didn&apos;t match the restock list — stock was updated with the counted number,
              and a follow-up task was raised in the inbox.
            </p>
          </div>
          {discrepancies.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">No discrepancies recorded. 🎉</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">When</th>
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium">Store</th>
                    <th className="px-3 py-2 font-medium text-right">Listed</th>
                    <th className="px-3 py-2 font-medium text-right">Counted</th>
                    <th className="px-3 py-2 font-medium text-right">Variance</th>
                    <th className="px-3 py-2 font-medium">Note</th>
                    <th className="px-3 py-2 font-medium">Checked by</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {discrepancies.map((d) => {
                    const diff = d.received - d.expected;
                    return (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 whitespace-nowrap text-slate-500">{fmtDateTime(d.createdAt)}</td>
                        <td className="px-3 py-2 text-slate-700">{d.productName}</td>
                        <td className="px-3 py-2 text-slate-500">{d.store}</td>
                        <td className="px-3 py-2 text-right text-slate-500">{d.expected}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{d.received}</td>
                        <td className={`px-3 py-2 text-right font-medium ${diff < 0 ? "text-red-600" : "text-emerald-600"}`}>
                          {diff > 0 ? `+${diff}` : diff}
                        </td>
                        <td className="px-3 py-2 text-slate-500">{d.note ?? "—"}</td>
                        <td className="px-3 py-2 text-slate-500">{d.checkedBy ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-slate-400">
        Sales recorded in <Link href="/transactions" className="underline">Transactions</Link> (StoreHub sync and manual
        entry) deduct stock automatically. Restock lists are received &amp; checked against the physical goods before
        they touch the counts. Wix&apos;s single-pool figure is shown as a reference only.
      </p>
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: number; accent?: "amber" | "red" | "blue" }) {
  const color =
    accent === "amber" ? "text-amber-600" : accent === "red" ? "text-red-600" : accent === "blue" ? "text-blue-600" : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
    </div>
  );
}
