import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { deleteCustomer } from "../actions";
import PetManager from "./PetManager";
import { predictionsForCustomer } from "@/lib/refill";
import { marginMixForCustomer, pct } from "@/lib/analytics";
import { formatPhoneDisplay, whatsappLink } from "@/lib/phone";
import { fmtDate, fmtDateTime, rm } from "@/lib/format";
import {
  STORE_LABELS,
  SOURCE_LABELS,
  SUPPLIER_LABELS,
  SUPPLIER_COLORS,
  REFILL_WINDOW_DAYS,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      pets: true,
      transactions: {
        orderBy: { transactionDate: "desc" },
        include: {
          lines: {
            include: {
              product: { select: { name: true, supplierType: true } },
              pet: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!customer) notFound();

  const predictions = await predictionsForCustomer(id);
  const mix = await marginMixForCustomer(id);
  const wa = whatsappLink(customer.phone);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/customers" className="text-sm text-slate-500 hover:underline">
          ← Back to customers
        </Link>
      </div>

      {/* Header / profile */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
              {customer.name ?? <span className="text-slate-400 italic">Unnamed customer</span>}
              {customer.needsDetails && (
                <span className="text-xs uppercase tracking-wide bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                  needs details
                </span>
              )}
            </h1>
            <p className="text-slate-600 font-mono text-sm mt-1">{formatPhoneDisplay(customer.phone)}</p>
          </div>
          <div className="flex gap-2">
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-green-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-green-700"
              >
                WhatsApp
              </a>
            )}
            <Link
              href={`/customers/${id}/edit`}
              className="bg-slate-200 text-slate-800 px-3 py-2 rounded-md text-sm font-medium hover:bg-slate-300"
            >
              Edit
            </Link>
            <form action={deleteCustomer}>
              <input type="hidden" name="id" value={id} />
              <button className="bg-red-50 text-red-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-red-100 border border-red-200">
                Delete
              </button>
            </form>
          </div>
        </div>

        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 text-sm">
          <div>
            <dt className="text-slate-400">Email</dt>
            <dd className="text-slate-800">{customer.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Preferred store</dt>
            <dd className="text-slate-800">{STORE_LABELS[customer.preferredStore]}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Source</dt>
            <dd className="text-slate-800">{SOURCE_LABELS[customer.source]}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Marketing consent</dt>
            <dd className="text-slate-800">
              {customer.marketingConsent ? `Yes (${fmtDate(customer.consentDate)})` : "No"}
            </dd>
          </div>
        </dl>
        {customer.notes && (
          <div className="mt-4 text-sm">
            <dt className="text-slate-400">Notes</dt>
            <dd className="text-slate-700 whitespace-pre-wrap">{customer.notes}</dd>
          </div>
        )}
      </div>

      {/* Pets */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-3">Pets ({customer.pets.length})</h2>
        <PetManager customerId={id} pets={customer.pets} />
      </div>

      {/* Refill predictions + margin mix side by side */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-1">Refill predictions</h2>
          <p className="text-xs text-slate-400 mb-3">
            Consumables only · based on this customer&apos;s repurchase intervals
          </p>
          {predictions.length === 0 ? (
            <p className="text-sm text-slate-400">No consumable purchases yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-slate-400 text-left text-xs">
                <tr>
                  <th className="py-1 font-medium">Product</th>
                  <th className="py-1 font-medium">Pet(s)</th>
                  <th className="py-1 font-medium">Next due</th>
                  <th className="py-1 font-medium text-right">Days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {predictions.map((p) => (
                  <tr key={p.productId}>
                    <td className="py-1.5 text-slate-700">{p.productName}</td>
                    <td className="py-1.5 text-slate-500">{p.petNames.join(", ") || "—"}</td>
                    <td className="py-1.5 text-slate-700">{fmtDate(p.predictedNextDate)}</td>
                    <td
                      className={`py-1.5 text-right font-medium ${
                        p.daysUntilDue <= REFILL_WINDOW_DAYS ? "text-red-600" : "text-slate-500"
                      }`}
                    >
                      {p.daysUntilDue < 0 ? `${Math.abs(p.daysUntilDue)} overdue` : `${p.daysUntilDue}d`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-1">Margin mix</h2>
          <p className="text-xs text-slate-400 mb-3">Share of lifetime spend by supplier type</p>
          {mix.total === 0 ? (
            <p className="text-sm text-slate-400">No spend recorded.</p>
          ) : (
            <div className="space-y-3">
              {/* stacked bar */}
              <div className="flex h-6 rounded-md overflow-hidden">
                {(["INHOUSE", "CONSIGNMENT", "TRADING", "UNCLASSIFIED"] as const).map((k) =>
                  mix[k] > 0 ? (
                    <div
                      key={k}
                      style={{ width: `${pct(mix[k], mix.total)}%`, backgroundColor: SUPPLIER_COLORS[k] }}
                      title={`${SUPPLIER_LABELS[k] ?? k}: ${rm(mix[k])}`}
                    />
                  ) : null,
                )}
              </div>
              <ul className="text-sm space-y-1">
                {(["INHOUSE", "CONSIGNMENT", "TRADING", "UNCLASSIFIED"] as const).map((k) => (
                  <li key={k} className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: SUPPLIER_COLORS[k] }} />
                      {SUPPLIER_LABELS[k] ?? "Unclassified"}
                    </span>
                    <span className="text-slate-600">
                      {rm(mix[k])} ({pct(mix[k], mix.total)}%)
                    </span>
                  </li>
                ))}
                <li className="flex items-center justify-between border-t border-slate-100 pt-1 font-medium">
                  <span>Total</span>
                  <span>{rm(mix.total)}</span>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Purchase history */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-3">
          Purchase history ({customer.transactions.length})
        </h2>
        {customer.transactions.length === 0 ? (
          <p className="text-sm text-slate-400">No transactions yet.</p>
        ) : (
          <div className="space-y-3">
            {customer.transactions.map((t) => (
              <div key={t.id} className="border border-slate-200 rounded-lg p-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-slate-800">
                    {fmtDateTime(t.transactionDate)} · {STORE_LABELS[t.store]}
                  </span>
                  <span className="text-slate-600">{rm(t.totalAmount)}</span>
                </div>
                {t.storehubRef && (
                  <div className="text-xs text-slate-400">Ref: {t.storehubRef}</div>
                )}
                <table className="w-full text-sm mt-2">
                  <tbody className="divide-y divide-slate-50">
                    {t.lines.map((l) => (
                      <tr key={l.id}>
                        <td className="py-1 text-slate-700">
                          {l.product?.name ?? (
                            <span className="text-amber-600">{l.rawProductName} (unmatched)</span>
                          )}
                          {l.pet && <span className="text-slate-400"> · for {l.pet.name}</span>}
                          {l.product && (
                            <span
                              className="ml-2 text-[10px] uppercase px-1 py-0.5 rounded"
                              style={{
                                backgroundColor: SUPPLIER_COLORS[l.product.supplierType] + "22",
                                color: SUPPLIER_COLORS[l.product.supplierType],
                              }}
                            >
                              {SUPPLIER_LABELS[l.product.supplierType]}
                            </span>
                          )}
                        </td>
                        <td className="py-1 text-right text-slate-500 whitespace-nowrap">
                          {l.quantity} × {rm(l.unitPrice)} = {rm(l.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
