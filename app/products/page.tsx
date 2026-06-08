import Link from "next/link";
import { prisma } from "@/lib/db";
import { rm, fmtDateTime } from "@/lib/format";
import SyncButton from "@/app/wix/SyncButton";
import {
  SUPPLIER_LABELS,
  SUPPLIER_COLORS,
  SPECIES_LABELS,
  LIFESTAGE_LABELS,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; supplier?: string; consumable?: string }>;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q, supplier, consumable } = await searchParams;

  const where: Record<string, unknown> = {};
  if (q && q.trim()) {
    const term = q.trim();
    where.OR = [
      { name: { contains: term } },
      { sku: { contains: term } },
      { brand: { contains: term } },
      { category: { contains: term } },
    ];
  }
  if (supplier && supplier !== "ALL") where.supplierType = supplier;
  if (consumable === "1") where.isConsumable = true;

  const products = await prisma.product.findMany({
    where,
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: { _count: { select: { lines: true } } },
  });

  // Wix inventory sync status (Wix is the source of truth for on-hand stock).
  const wixConfigured = !!(process.env.WIX_API_KEY && process.env.WIX_SITE_ID);
  const [wixSyncedCount, wixLast] = await Promise.all([
    prisma.product.count({ where: { wixStock: { not: null } } }),
    prisma.product.findFirst({
      where: { wixSyncedAt: { not: null } },
      orderBy: { wixSyncedAt: "desc" },
      select: { wixSyncedAt: true },
    }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Products</h1>
          <p className="text-sm text-slate-500">
            {products.length} {products.length === 1 ? "product" : "products"}
          </p>
        </div>
        <Link
          href="/products/new"
          className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-700"
        >
          + New product
        </Link>
      </div>

      {/* Wix inventory — source of truth for on-hand stock */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
        {!wixConfigured && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 mb-3">
            <strong>Wix not configured.</strong> Set <code>WIX_API_KEY</code> and{" "}
            <code>WIX_SITE_ID</code> in the environment to enable inventory syncing.
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <span className="font-medium text-slate-800">Wix inventory</span>
            <span className="text-slate-400">
              {" "}
              · {wixSyncedCount} products with Wix stock · last synced{" "}
              {wixLast?.wixSyncedAt ? fmtDateTime(wixLast.wixSyncedAt) : "never"}
            </span>
          </div>
          <SyncButton disabled={!wixConfigured} />
        </div>
      </div>

      <form className="bg-white border border-slate-200 rounded-lg p-3 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Search (name, SKU, brand, category)
          </label>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="e.g. Royal Canin or HW-FC…"
            className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Supplier type</label>
          <select
            name="supplier"
            defaultValue={supplier ?? "ALL"}
            className="border border-slate-300 rounded-md px-3 py-1.5 text-sm"
          >
            <option value="ALL">All</option>
            <option value="INHOUSE">In-house</option>
            <option value="CONSIGNMENT">Consignment</option>
            <option value="TRADING">Trading</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 pb-1.5">
          <input type="checkbox" name="consumable" value="1" defaultChecked={consumable === "1"} />
          Consumables only
        </label>
        <button className="bg-slate-200 text-slate-800 px-4 py-1.5 rounded-md text-sm font-medium hover:bg-slate-300">
          Apply
        </button>
        <Link href="/products" className="text-sm text-slate-500 hover:underline pb-1.5">
          Reset
        </Link>
      </form>

      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left text-xs">
            <tr>
              <th className="px-4 py-2 font-medium">SKU</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Target</th>
              <th className="px-4 py-2 font-medium">Supplier</th>
              <th className="px-4 py-2 font-medium text-right">Cost</th>
              <th className="px-4 py-2 font-medium text-right">Retail</th>
              <th className="px-4 py-2 font-medium text-center">Available</th>
              <th className="px-4 py-2 font-medium text-center">Wix stock</th>
              <th className="px-4 py-2 font-medium text-center">Consumable</th>
              <th className="px-4 py-2 font-medium text-right">Sold</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-mono text-xs text-slate-500">{p.sku}</td>
                <td className="px-4 py-2">
                  <div className="font-medium text-slate-900">{p.name}</div>
                  {p.brand && <div className="text-xs text-slate-400">{p.brand}</div>}
                </td>
                <td className="px-4 py-2 text-slate-600">{p.category}</td>
                <td className="px-4 py-2 text-slate-600 text-xs">
                  {SPECIES_LABELS[p.targetSpecies] ?? p.targetSpecies}
                  {p.lifeStage !== "ANY" && (
                    <span className="text-slate-400"> · {LIFESTAGE_LABELS[p.lifeStage]}</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <span
                    className="text-[10px] uppercase font-medium px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: SUPPLIER_COLORS[p.supplierType] + "22",
                      color: SUPPLIER_COLORS[p.supplierType],
                    }}
                  >
                    {SUPPLIER_LABELS[p.supplierType]}
                  </span>
                </td>
                <td className="px-4 py-2 text-right text-slate-500">{rm(p.costPrice)}</td>
                <td className="px-4 py-2 text-right text-slate-700">{rm(p.retailPrice)}</td>
                <td className="px-4 py-2 text-center">
                  {(() => {
                    const total = p.stockKL + p.stockPJ;
                    const color =
                      total === 0 ? "text-red-500" : total <= 2 ? "text-amber-600" : "text-slate-800";
                    return (
                      <div title={`PJ ${p.stockPJ} · KL ${p.stockKL}`}>
                        <span className={`font-medium ${color}`}>{total}</span>
                        <div className="text-[10px] text-slate-400">
                          PJ {p.stockPJ} · KL {p.stockKL}
                        </div>
                      </div>
                    );
                  })()}
                </td>
                <td className="px-4 py-2 text-center">
                  {p.wixStock != null ? (
                    <span
                      className={`font-medium ${
                        p.wixStock === 0
                          ? "text-red-500"
                          : p.wixStock <= 2
                            ? "text-amber-600"
                            : "text-slate-800"
                      }`}
                    >
                      {p.wixStock}
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-4 py-2 text-center">
                  {p.isConsumable && (
                    <span className="inline-block text-[10px] font-medium uppercase tracking-wide bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">
                      Yes
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right text-slate-500">{p._count.lines}</td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/products/${p.id}/edit`} className="text-xs text-slate-600 hover:underline">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-slate-400">
                  No products match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
