"use client";

import { useState } from "react";
import Link from "next/link";
import { formatPhoneDisplay, whatsappLink } from "@/lib/phone";
import { rm } from "@/lib/format";
import { SUPPLIER_COLORS, SUPPLIER_LABELS } from "@/lib/constants";
import type { CustomerMarginRow, LifecycleRow, ProductAnalysisRow } from "@/lib/analytics";

type Tab = "lifecycle" | "margin" | "products";

export default function AnalysisView({
  lifecycle,
  margin,
  products,
}: {
  lifecycle: LifecycleRow[];
  margin: CustomerMarginRow[];
  products: ProductAnalysisRow[];
}) {
  const [tab, setTab] = useState<Tab>("lifecycle");

  return (
    <div>
      <div className="flex gap-2 mb-4 border-b border-slate-200">
        {(
          [
            ["lifecycle", "Lifecycle"],
            ["margin", "Margin mix"],
            ["products", "Product analysis"],
          ] as Array<[Tab, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === key
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "lifecycle" && <LifecycleView rows={lifecycle} />}
      {tab === "margin" && <MarginTable rows={margin} />}
      {tab === "products" && <ProductAnalysisTable rows={products} />}
    </div>
  );
}

// ---------------- Lifecycle ----------------
function LifecycleView({ rows }: { rows: LifecycleRow[] }) {
  const newParents = rows.filter((r) => r.isNewPetParent);
  const seniors = rows.filter((r) => r.hasSenior);

  return (
    <div className="space-y-6">
      <Segment
        title="New pet parents — high LTV"
        subtitle="Youngest pet is a puppy/kitten. Onboard them onto Haiwan in-house staples early."
        rows={newParents}
        accent="green"
      />
      <Segment
        title="Senior-pet owners — cross-sell"
        subtitle="At least one senior pet. Surface joint supplements and senior diets."
        rows={seniors}
        accent="blue"
      />
    </div>
  );
}

function Segment({
  title,
  subtitle,
  rows,
  accent,
}: {
  title: string;
  subtitle: string;
  rows: LifecycleRow[];
  accent: "green" | "blue";
}) {
  const border = accent === "green" ? "border-green-200" : "border-blue-200";
  return (
    <div className={`bg-white border ${border} rounded-lg p-5`}>
      <h3 className="font-semibold text-slate-800">{title}</h3>
      <p className="text-xs text-slate-400 mb-3">{subtitle}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">No customers in this segment.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-slate-400 text-left text-xs">
            <tr>
              <th className="py-1 font-medium">Customer</th>
              <th className="py-1 font-medium">Pets</th>
              <th className="py-1 font-medium text-right">Contact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const wa = whatsappLink(r.phone);
              return (
                <tr key={r.customerId}>
                  <td className="py-2">
                    <Link href={`/customers/${r.customerId}`} className="font-medium text-slate-900 hover:underline">
                      {r.name ?? "Unnamed"}
                    </Link>
                    <div className="text-xs text-slate-400 font-mono">{formatPhoneDisplay(r.phone)}</div>
                  </td>
                  <td className="py-2 text-slate-600">
                    <span className="flex flex-wrap gap-1">
                      {r.pets.map((p, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-xs bg-slate-100 rounded px-1.5 py-0.5">
                          {p.name}
                          <span className="text-slate-400">
                            {p.stage === "PUPPY_KITTEN" ? "young" : p.stage === "SENIOR" ? "senior" : p.stage === "ADULT" ? "adult" : "?"}
                          </span>
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    {wa && (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block bg-green-600 text-white px-2.5 py-1 rounded text-xs font-medium hover:bg-green-700"
                      >
                        WhatsApp
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------- Margin mix ----------------
function MarginTable({ rows }: { rows: CustomerMarginRow[] }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
      <p className="text-xs text-slate-400 px-3 pt-3">
        Share of each customer&apos;s spend by supplier type. Sorted by trading-share — the top
        rows are the best <strong>&ldquo;convert to in-house&rdquo;</strong> candidates.
      </p>
      <table className="w-full text-sm mt-2">
        <thead className="bg-slate-50 text-slate-500 text-left text-xs">
          <tr>
            <th className="px-3 py-2 font-medium">Customer</th>
            <th className="px-3 py-2 font-medium w-1/3">Mix</th>
            <th className="px-3 py-2 font-medium text-right">In-house</th>
            <th className="px-3 py-2 font-medium text-right">Trading</th>
            <th className="px-3 py-2 font-medium text-right">Total spend</th>
            <th className="px-3 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.customerId} className="hover:bg-slate-50">
              <td className="px-3 py-2">
                <Link href={`/customers/${r.customerId}`} className="font-medium text-slate-900 hover:underline">
                  {r.name ?? "Unnamed"}
                </Link>
              </td>
              <td className="px-3 py-2">
                <div className="flex h-4 rounded overflow-hidden w-full" title={`In-house ${r.inhousePct}% · Trading ${r.tradingPct}%`}>
                  {(["INHOUSE", "CONSIGNMENT", "TRADING", "UNCLASSIFIED"] as const).map((k) =>
                    r.mix[k] > 0 ? (
                      <div key={k} style={{ width: `${Math.round((r.mix[k] / r.mix.total) * 100)}%`, backgroundColor: SUPPLIER_COLORS[k] }} />
                    ) : null,
                  )}
                </div>
              </td>
              <td className="px-3 py-2 text-right text-green-700">{r.inhousePct}%</td>
              <td className="px-3 py-2 text-right text-amber-700 font-medium">{r.tradingPct}%</td>
              <td className="px-3 py-2 text-right text-slate-600">{rm(r.mix.total)}</td>
              <td className="px-3 py-2">
                {r.tradingPct >= 50 && (
                  <span className="text-[10px] uppercase font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded whitespace-nowrap">
                    convert target
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-4 text-xs text-slate-500 px-3 py-2 border-t border-slate-100">
        {(["INHOUSE", "CONSIGNMENT", "TRADING", "UNCLASSIFIED"] as const).map((k) => (
          <span key={k} className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: SUPPLIER_COLORS[k] }} />
            {SUPPLIER_LABELS[k] ?? "Unclassified"}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------- Product analysis ----------------
type ProductSortKey = "unitsSold" | "revenue" | "avgSellingPrice" | "retailPrice" | "marginPct";

function ProductAnalysisTable({ rows }: { rows: ProductAnalysisRow[] }) {
  const [sortKey, setSortKey] = useState<ProductSortKey>("unitsSold");
  const [asc, setAsc] = useState(false);
  const [supplier, setSupplier] = useState<"ALL" | "CONSIGNMENT" | "TRADING">("ALL");

  const filtered = supplier === "ALL" ? rows : rows.filter((r) => r.supplierType === supplier);
  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey] ?? -Infinity;
    const bv = b[sortKey] ?? -Infinity;
    return asc ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const maxUnits = Math.max(1, ...rows.map((r) => r.unitsSold));

  function header(key: ProductSortKey, label: string) {
    const active = sortKey === key;
    return (
      <th
        className="px-3 py-2 font-medium cursor-pointer select-none hover:text-slate-900 text-right whitespace-nowrap"
        onClick={() => {
          if (active) setAsc(!asc);
          else {
            setSortKey(key);
            setAsc(false);
          }
        }}
      >
        {label} {active ? (asc ? "▲" : "▼") : ""}
      </th>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
      <div className="flex items-start justify-between gap-3 px-3 pt-3 flex-wrap">
        <p className="text-xs text-slate-400 max-w-2xl">
          Consignment &amp; trading SKUs ranked by units sold and price. High volume on a
          third-party line is proven demand we currently buy in —{" "}
          <strong>the strongest candidates to build in-house</strong>. Click a column to sort.
        </p>
        <div className="flex gap-1 shrink-0">
          {(["ALL", "CONSIGNMENT", "TRADING"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSupplier(s)}
              className={`px-2.5 py-1 rounded text-xs font-medium ${
                supplier === s ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s === "ALL" ? "All" : SUPPLIER_LABELS[s]}
            </button>
          ))}
        </div>
      </div>
      <table className="w-full text-sm mt-2">
        <thead className="bg-slate-50 text-slate-500 text-left text-xs">
          <tr>
            <th className="px-3 py-2 font-medium">Product</th>
            <th className="px-3 py-2 font-medium">Supplier</th>
            {header("unitsSold", "Units sold")}
            {header("revenue", "Revenue")}
            {header("avgSellingPrice", "Avg price")}
            {header("retailPrice", "Retail")}
            {header("marginPct", "Margin")}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((r) => (
            <tr key={r.productId} className="hover:bg-slate-50">
              <td className="px-3 py-2">
                <Link href={`/products/${r.productId}/edit`} className="font-medium text-slate-900 hover:underline">
                  {r.name}
                </Link>
                <div className="text-xs text-slate-400">
                  {r.category}
                  {r.brand && ` · ${r.brand}`}
                </div>
              </td>
              <td className="px-3 py-2">
                <span
                  className="text-[10px] uppercase font-medium px-2 py-0.5 rounded whitespace-nowrap"
                  style={{
                    backgroundColor: SUPPLIER_COLORS[r.supplierType] + "22",
                    color: SUPPLIER_COLORS[r.supplierType],
                  }}
                >
                  {SUPPLIER_LABELS[r.supplierType]}
                </span>
              </td>
              <td className="px-3 py-2 text-right">
                <div className="flex items-center justify-end gap-2">
                  <span className="hidden sm:block w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <span
                      className="block h-full bg-slate-400"
                      style={{ width: `${Math.round((r.unitsSold / maxUnits) * 100)}%` }}
                    />
                  </span>
                  <span className="font-medium text-slate-800 tabular-nums">{r.unitsSold}</span>
                </div>
              </td>
              <td className="px-3 py-2 text-right text-slate-700 tabular-nums">{rm(r.revenue)}</td>
              <td className="px-3 py-2 text-right text-slate-600 tabular-nums">
                {r.avgSellingPrice > 0 ? rm(r.avgSellingPrice) : "—"}
              </td>
              <td className="px-3 py-2 text-right text-slate-500 tabular-nums">
                {r.retailPrice != null ? rm(r.retailPrice) : "—"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {r.marginPct == null ? (
                  <span className="text-slate-300">—</span>
                ) : (
                  <span className={r.marginPct >= 40 ? "text-green-700 font-medium" : "text-slate-600"}>
                    {r.marginPct}%
                  </span>
                )}
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                No consignment or trading products to analyse yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
