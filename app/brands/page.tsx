import Link from "next/link";
import { brandList, TRIAL_WINDOW_DAYS, reconcileBrandTrials, type BrandListRow } from "@/lib/brands";
import { productAnalysis } from "@/lib/analytics";
import { getAssumptions } from "@/lib/breakeven";
import { setBrandStatus, updateBreakevenAssumptions } from "./actions";
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

function FitTrialTags({ b }: { b: BrandListRow }) {
  return (
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
  );
}

/** The consignment partnership pipeline: brands grouped by lifecycle status. */
function PipelineTable({ rows }: { rows: BrandListRow[] }) {
  return (
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
                <Link href={`/brands/${b.id}`} className="font-medium text-slate-900 hover:underline">{b.name}</Link>
                <FitTrialTags b={b} />
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
                      <button name="status" value="DROPPED" className="rounded px-2 py-0.5 text-xs text-rose-600 hover:underline">Drop</button>
                    </form>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A simpler roster for trading / in-house brands (no partnership lifecycle). */
function FlatTable({ rows }: { rows: BrandListRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-sm">
        <thead className="bg-slate-50 text-left text-xs text-slate-500">
          <tr>
            <th className="px-3 py-2 font-medium">Brand</th>
            <th className="px-3 py-2 font-medium">Owner</th>
            <th className="px-3 py-2 font-medium text-right">Products</th>
            <th className="px-3 py-2 font-medium text-right">Units</th>
            <th className="px-3 py-2 font-medium text-right">Revenue</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((b) => (
            <tr key={b.id} className="hover:bg-slate-50">
              <td className="px-3 py-2">
                <Link href={`/brands/${b.id}`} className="font-medium text-slate-900 hover:underline">{b.name}</Link>
              </td>
              <td className="px-3 py-2 text-slate-600">{b.owner ?? "—"}</td>
              <td className="px-3 py-2 text-right text-slate-600">{b.rollup.productCount}</td>
              <td className="px-3 py-2 text-right text-slate-600">{b.rollup.units}</td>
              <td className="px-3 py-2 text-right text-slate-700">{rm(b.rollup.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function BrandsPage() {
  await reconcileBrandTrials();
  const [brands, candidates, assumptions] = await Promise.all([brandList(), productAnalysis(), getAssumptions()]);
  const aInput = "w-24 rounded-md border border-slate-200 px-2 py-1 text-sm";

  // Three buckets by supplier type. Co-creation is a partnership graduation, so
  // it rides with consignment (fees/commission economics + breakeven apply).
  const consignment = brands.filter((b) => b.supplierType === "CONSIGNMENT" || b.supplierType === "CO_CREATION");
  const trading = brands.filter((b) => b.supplierType === "TRADING");
  const inhouse = brands.filter((b) => b.supplierType === "INHOUSE");

  const consignmentByStatus = new Map<string, BrandListRow[]>();
  for (const b of consignment) {
    if (!consignmentByStatus.has(b.status)) consignmentByStatus.set(b.status, []);
    consignmentByStatus.get(b.status)!.push(b);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Brands</h1>
          <p className="text-sm text-slate-500">Split by how Haiwan sources them — trading, consignment partnerships, and in-house.</p>
        </div>
        <NewBrandForm />
      </div>

      {/* ---------------- Consignment: the partnership pipeline + breakeven ---------------- */}
      <section className="space-y-4">
        <div className="flex items-baseline gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Consignment — partnerships</h2>
          <span className="text-sm text-slate-400">· {consignment.length}</span>
        </div>
        <p className="-mt-2 text-sm text-slate-500">
          Partners pay listing fees + commission, so each has a breakeven target (open a brand to see it). Move brands through the pipeline as they progress.
        </p>

        {/* Breakeven assumptions — only relevant to consignment economics. */}
        <details className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">
            Breakeven assumptions
            <span className="ml-2 text-xs font-normal text-slate-400">
              USD {assumptions.fxUsdMyr} · SGD {assumptions.fxSgdMyr} · {assumptions.defaultMarkup}× markup
            </span>
          </summary>
          <form action={updateBreakevenAssumptions} className="mt-3 flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">USD → MYR</label>
              <input name="fxUsdMyr" type="number" step="0.01" defaultValue={assumptions.fxUsdMyr} className={aInput} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">SGD → MYR</label>
              <input name="fxSgdMyr" type="number" step="0.01" defaultValue={assumptions.fxSgdMyr} className={aInput} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Default markup (×cost)</label>
              <input name="defaultVendorMarkup" type="number" step="0.1" defaultValue={assumptions.defaultMarkup} className={aInput} />
            </div>
            <button className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">Save</button>
            <p className="w-full text-xs text-slate-400">
              FX converts each partner&apos;s native fees to RM. Markup sets COGS as a share of RRP (COGS% = 1 ÷ markup) when a brand hasn&apos;t set its own.
            </p>
          </form>
        </details>

        {consignment.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
            No consignment partners yet — add one with type “Consignment”.
          </p>
        ) : (
          STATUS_ORDER.map((status) => {
            const rows = consignmentByStatus.get(status) ?? [];
            if (rows.length === 0) return null;
            return (
              <div key={status} className="rounded-lg border border-slate-200 bg-white">
                <div className="border-b border-slate-100 px-4 py-2.5">
                  <h3 className="text-sm font-semibold text-slate-700">
                    {STATUS_LABELS[status]} <span className="text-slate-400">· {rows.length}</span>
                  </h3>
                </div>
                <PipelineTable rows={rows} />
              </div>
            );
          })
        )}
      </section>

      {/* ---------------- Trading ---------------- */}
      <section className="space-y-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Trading</h2>
          <span className="text-sm text-slate-400">· {trading.length}</span>
        </div>
        <p className="-mt-1 text-sm text-slate-500">Bought and resold — no partner fees, so no breakeven tracker.</p>
        <div className="rounded-lg border border-slate-200 bg-white">
          {trading.length === 0
            ? <p className="px-4 py-8 text-center text-sm text-slate-400">No trading brands yet.</p>
            : <FlatTable rows={trading} />}
        </div>
      </section>

      {/* ---------------- In-house ---------------- */}
      <section className="space-y-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-lg font-semibold text-slate-900">In-house</h2>
          <span className="text-sm text-slate-400">· {inhouse.length}</span>
        </div>
        <p className="-mt-1 text-sm text-slate-500">Haiwan&apos;s own brand — highest margin, strategic priority.</p>
        <div className="rounded-lg border border-slate-200 bg-white">
          {inhouse.length === 0
            ? <p className="px-4 py-8 text-center text-sm text-slate-400">No in-house brands yet.</p>
            : <FlatTable rows={inhouse} />}
        </div>

        {/* Convert-to-in-house report — trading & consignment products worth taking in-house. */}
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">In-house candidates</h3>
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
        </div>
      </section>

      {brands.length === 0 && (
        <p className="rounded-lg border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400">
          No brands yet — add one, or they&apos;ll appear here once products are linked to brands.
        </p>
      )}
    </div>
  );
}
