import Link from "next/link";
import { brandList, TRIAL_WINDOW_DAYS, reconcileBrandTrials, type BrandListRow } from "@/lib/brands";
import { productAnalysis } from "@/lib/analytics";
import { setBrandStatus } from "./actions";
import NewBrandForm from "./NewBrandForm";
import { rm } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_ORDER = ["PROSPECT", "IN_TALKS", "TRIAL", "ACTIVE", "DROPPED"] as const;
const STATUS_LABELS: Record<string, string> = {
  PROSPECT: "Prospect", IN_TALKS: "In talks", TRIAL: "Trial", ACTIVE: "Active", DROPPED: "Dropped",
};
const SUPPLIER_LABELS: Record<string, string> = {
  TRADING: "Trading", CONSIGNMENT: "Consignment", INHOUSE: "In-house", CO_CREATION: "Co-creation",
};
const FIT_STYLES: Record<string, string> = {
  HIGH: "bg-emerald-100 text-emerald-700",
  CONDITIONAL: "bg-amber-100 text-amber-700",
  VERIFY: "bg-slate-100 text-slate-600",
  SKIP: "bg-rose-100 text-rose-700",
};

// Next status in the pipeline, for the quick "advance" button.
const NEXT_STATUS: Record<string, string | null> = {
  PROSPECT: "IN_TALKS", IN_TALKS: "TRIAL", TRIAL: "ACTIVE", ACTIVE: null, DROPPED: null,
};

export default async function BrandsPage() {
  await reconcileBrandTrials();
  const [brands, candidates] = await Promise.all([brandList(), productAnalysis()]);

  const byStatus = new Map<string, BrandListRow[]>();
  for (const b of brands) {
    if (!byStatus.has(b.status)) byStatus.set(b.status, []);
    byStatus.get(b.status)!.push(b);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Brand pipeline</h1>
          <p className="text-sm text-slate-500">Supplier &amp; consignment partnerships, backed by real sell-through.</p>
        </div>
        <NewBrandForm />
      </div>

      {STATUS_ORDER.map((status) => {
        const rows = byStatus.get(status) ?? [];
        if (rows.length === 0) return null;
        return (
          <section key={status} className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-2.5">
              <h2 className="text-sm font-semibold text-slate-700">
                {STATUS_LABELS[status]} <span className="text-slate-400">· {rows.length}</span>
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Brand</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Owner</th>
                    <th className="px-3 py-2 font-medium">Next step</th>
                    <th className="px-3 py-2 font-medium text-right">Products</th>
                    <th className="px-3 py-2 font-medium text-right">Units</th>
                    <th className="px-3 py-2 font-medium text-right">Revenue</th>
                    <th className="px-3 py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <Link href={`/brands/${b.id}`} className="font-medium text-slate-900 hover:underline">
                          {b.name}
                        </Link>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          {b.aestheticFit && (
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${FIT_STYLES[b.aestheticFit]}`}>
                              {b.aestheticFit.toLowerCase()}
                            </span>
                          )}
                          {b.trialDay != null && (
                            <span className={`text-[10px] ${b.trialDay >= TRIAL_WINDOW_DAYS ? "font-semibold text-rose-600" : "text-slate-400"}`}>
                              trial day {b.trialDay}{b.trialDay >= TRIAL_WINDOW_DAYS ? " · review due" : `/${TRIAL_WINDOW_DAYS}`}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{SUPPLIER_LABELS[b.supplierType]}</td>
                      <td className="px-3 py-2 text-slate-600">{b.owner ?? "—"}</td>
                      <td className="px-3 py-2 text-slate-500">{b.nextStep ?? "—"}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{b.rollup.productCount}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{b.rollup.units}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{rm(b.rollup.revenue)}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          {NEXT_STATUS[b.status] && (
                            <form action={setBrandStatus}>
                              <input type="hidden" name="id" value={b.id} />
                              <button name="status" value={NEXT_STATUS[b.status]!} className="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50">
                                → {STATUS_LABELS[NEXT_STATUS[b.status]!]}
                              </button>
                            </form>
                          )}
                          {b.status !== "DROPPED" && (
                            <form action={setBrandStatus}>
                              <input type="hidden" name="id" value={b.id} />
                              <button name="status" value="DROPPED" className="rounded px-2 py-0.5 text-xs text-rose-600 hover:underline">
                                Drop
                              </button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {brands.length === 0 && (
        <p className="rounded-lg border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400">
          No brands yet — add one, or they&apos;ll appear here once products are linked to brands.
        </p>
      )}

      {/* Convert-to-in-house report */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">In-house candidates</h2>
          <p className="text-xs text-slate-400">
            Trading &amp; consignment products with proven demand — strongest to replace with in-house / co-created lines.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium text-right">Units</th>
                <th className="px-3 py-2 font-medium text-right">Revenue</th>
                <th className="px-3 py-2 font-medium text-right">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {candidates.slice(0, 12).map((p) => (
                <tr key={p.productId} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-800">
                    {p.name} {p.brand && <span className="text-xs text-slate-400">· {p.brand}</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{SUPPLIER_LABELS[p.supplierType]}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{p.unitsSold}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{rm(p.revenue)}</td>
                  <td className="px-3 py-2 text-right text-slate-500">{p.marginPct != null ? `${p.marginPct}%` : "—"}</td>
                </tr>
              ))}
              {candidates.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No trading/consignment sales yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
