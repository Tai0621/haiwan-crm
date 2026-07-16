import Link from "next/link";
import { notFound } from "next/navigation";
import { brandDetail, TRIAL_WINDOW_DAYS, NEW_WINDOW_DAYS } from "@/lib/brands";
import { brandBreakeven } from "@/lib/breakeven";
import { updateBrand } from "../actions";
import { rm } from "@/lib/format";
import BreakevenCard from "./BreakevenCard";

export const dynamic = "force-dynamic";

const SUPPLIER_LABELS: Record<string, string> = {
  TRADING: "Trading", CONSIGNMENT: "Consignment", INHOUSE: "In-house", CO_CREATION: "Co-creation",
};
const STATUS_LABELS: Record<string, string> = {
  PROSPECT: "Prospect", IN_TALKS: "In talks", TRIAL: "Trial", ACTIVE: "Active", DROPPED: "Dropped",
};
const input = "w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm";
const label = "block text-xs font-medium text-slate-500 mb-1";

export default async function BrandDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await brandDetail(id);
  if (!detail) notFound();
  const { brand, trialDay, products, metrics } = detail;

  // Breakeven is a partnership economics concept (fees + commission), so it only
  // applies to consignment / co-creation brands — not trading or in-house.
  const isPartnership = brand.supplierType === "CONSIGNMENT" || brand.supplierType === "CO_CREATION";
  const breakeven = isPartnership ? await brandBreakeven(id) : null;
  const isNewPartner =
    isPartnership && Date.now() - brand.createdAt.getTime() < NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  const isoDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

  return (
    <div className="space-y-6">
      <Link href="/brands" className="text-sm text-slate-500 hover:underline">← Back to pipeline</Link>

      {/* Header */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900">
              {brand.name}
              {isNewPartner && (
                <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-blue-700">New</span>
              )}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {SUPPLIER_LABELS[brand.supplierType]} · {STATUS_LABELS[brand.status]}
              {brand.owner ? ` · ${brand.owner}` : ""}
              {brand.country ? ` · ${brand.country}` : ""}
            </p>
          </div>
          {brand.website && (
            <a href={brand.website} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
              {brand.website}
            </a>
          )}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <div><dt className="text-slate-400">Listing fee</dt><dd className="text-slate-800">{brand.listingFee != null ? rm(brand.listingFee) : "—"}</dd></div>
          <div><dt className="text-slate-400">Commission</dt><dd className="text-slate-800">{brand.commissionPct != null ? `${brand.commissionPct}%` : "—"}</dd></div>
          <div><dt className="text-slate-400">Aesthetic fit</dt><dd className="text-slate-800">{brand.aestheticFit ?? "—"}</dd></div>
          <div>
            <dt className="text-slate-400">Trial</dt>
            <dd className="text-slate-800">
              {trialDay != null ? (
                <span className={trialDay >= TRIAL_WINDOW_DAYS ? "font-semibold text-rose-600" : ""}>
                  day {trialDay} / {TRIAL_WINDOW_DAYS}{trialDay >= TRIAL_WINDOW_DAYS ? " · review due" : ""}
                </span>
              ) : "—"}
            </dd>
          </div>
        </dl>
        {brand.nextStep && <p className="mt-3 text-sm text-slate-600"><span className="text-slate-400">Next step:</span> {brand.nextStep}</p>}
        {brand.notes && <p className="mt-1 text-sm text-slate-600 whitespace-pre-wrap">{brand.notes}</p>}
      </div>

      {/* Partner breakeven KPI */}
      {breakeven && <BreakevenCard b={breakeven} />}

      {/* Trial metrics */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Trial performance</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Metric label="Units sold" value={String(metrics.units)} />
            <Metric label="Revenue" value={rm(metrics.revenue)} />
            <Metric label="Identified buyers" value={String(metrics.buyers)} />
            <Metric label="Repurchase rate" value={`${Math.round(metrics.repurchaseRate * 100)}%`} />
          </div>
          <div className="mt-4">
            <h3 className="text-xs font-medium text-slate-400">Buyer profile</h3>
            {metrics.buyerProfile.length === 0 ? (
              <p className="text-sm text-slate-400">No pet-attributed sales yet.</p>
            ) : (
              <ul className="mt-1 space-y-0.5 text-sm">
                {metrics.buyerProfile.slice(0, 6).map((p) => (
                  <li key={p.label} className="flex justify-between">
                    <span className="text-slate-600">{p.label}</span>
                    <span className="text-slate-500">{p.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Basket adjacency</h2>
          <p className="mb-2 text-xs text-slate-400">What else buyers put in the same basket.</p>
          {metrics.basketAdjacency.length === 0 ? (
            <p className="text-sm text-slate-400">No co-purchases recorded yet.</p>
          ) : (
            <ul className="space-y-0.5 text-sm">
              {metrics.basketAdjacency.map((a) => (
                <li key={a.name} className="flex justify-between">
                  <span className="text-slate-700">{a.name} <span className="text-xs text-slate-400">· {a.category}</span></span>
                  <span className="text-slate-500">{a.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Linked products */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">Linked products ({products.length})</h2>
        </div>
        {products.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400">No products linked to this brand.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 font-medium text-right">Units</th>
                  <th className="px-3 py-2 font-medium text-right">Revenue</th>
                  <th className="px-3 py-2 font-medium text-right">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-800">{p.name} <span className="font-mono text-xs text-slate-400">{p.sku}</span></td>
                    <td className="px-3 py-2 text-right text-slate-600">{p.units}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{rm(p.revenue)}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{p.marginPct != null ? `${p.marginPct}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit */}
      <details className="rounded-lg border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">Edit brand</summary>
        <form action={updateBrand} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input type="hidden" name="id" value={brand.id} />
          <div className="sm:col-span-2">
            <label className={label}>Name</label>
            <input name="name" required defaultValue={brand.name} className={input} />
          </div>
          <div>
            <label className={label}>Owner</label>
            <select name="owner" defaultValue={brand.owner ?? ""} className={input}>
              <option value="">Unassigned</option>
              {["Dini", "Jeany", "Dannie", "Win Nie", "Evi"].map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Supplier type</label>
            <select name="supplierType" defaultValue={brand.supplierType} className={input}>
              {["TRADING", "CONSIGNMENT", "INHOUSE", "CO_CREATION"].map((s) => <option key={s} value={s}>{SUPPLIER_LABELS[s]}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Status</label>
            <select name="status" defaultValue={brand.status} className={input}>
              {["PROSPECT", "IN_TALKS", "TRIAL", "ACTIVE", "DROPPED"].map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Aesthetic fit</label>
            <select name="aestheticFit" defaultValue={brand.aestheticFit ?? ""} className={input}>
              <option value="">—</option>
              {["HIGH", "CONDITIONAL", "VERIFY", "SKIP"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div><label className={label}>Country</label><input name="country" defaultValue={brand.country ?? ""} className={input} /></div>
          <div><label className={label}>Website</label><input name="website" defaultValue={brand.website ?? ""} className={input} /></div>
          <div><label className={label}>Trial start</label><input name="trialStartDate" type="date" defaultValue={isoDate(brand.trialStartDate)} className={input} /></div>
          <div><label className={label}>Listing fee (RM, upfront)</label><input name="listingFee" type="number" step="0.01" defaultValue={brand.listingFee ?? ""} className={input} /></div>
          <div><label className={label}>Commission %</label><input name="commissionPct" type="number" step="0.1" defaultValue={brand.commissionPct ?? ""} className={input} /></div>
          <div className="sm:col-span-3 mt-1 border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Partner breakeven inputs</p>
          </div>
          <div>
            <label className={label}>Fee currency</label>
            <select name="feeCurrency" defaultValue={brand.feeCurrency ?? "MYR"} className={input}>
              {["MYR", "USD", "SGD"].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><label className={label}>Listing fee / mth (native)</label><input name="listingFeeMonthly" type="number" step="0.01" defaultValue={brand.listingFeeMonthly ?? ""} className={input} /></div>
          <div><label className={label}>Ad spend / mth (native)</label><input name="adSpendMonthly" type="number" step="0.01" defaultValue={brand.adSpendMonthly ?? ""} className={input} /></div>
          <div><label className={label}>Vendor markup (×cost)</label><input name="vendorMarkup" type="number" step="0.1" placeholder="default 3" defaultValue={brand.vendorMarkup ?? ""} className={input} /></div>
          <div><label className={label}>Target avg RRP / unit (RM)</label><input name="expectedAvgRrp" type="number" step="0.01" placeholder="until sales exist" defaultValue={brand.expectedAvgRrp ?? ""} className={input} /></div>
          <div className="sm:col-span-3"><label className={label}>Next step</label><input name="nextStep" defaultValue={brand.nextStep ?? ""} className={input} /></div>
          <div className="sm:col-span-3"><label className={label}>Notes</label><textarea name="notes" defaultValue={brand.notes ?? ""} className={input} rows={2} /></div>
          <div className="sm:col-span-3">
            <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">Save changes</button>
          </div>
        </form>
      </details>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
