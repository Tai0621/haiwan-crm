import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { deleteCustomer } from "../actions";
import PetManager from "./PetManager";
import LinkTransactionForm from "@/app/transactions/LinkTransactionForm";
import { unlinkTransaction } from "@/app/transactions/actions";
import { predictionsForCustomer } from "@/lib/refill";
import { inboxForCustomer } from "@/lib/tasks";
import { memberView } from "@/lib/membership";
import { claimMembershipAction, adjustPoints } from "@/app/actions/membership";
import InboxRow from "@/app/components/InboxRow";
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

  // These three reads are independent — run them in parallel so the page waits
  // on one round trip to the DB, not three back-to-back.
  const [customer, predictions, mix, actions, member, activeSubs] = await Promise.all([
    prisma.customer.findUnique({
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
    }),
    predictionsForCustomer(id),
    marginMixForCustomer(id),
    inboxForCustomer(id),
    memberView(id),
    prisma.subscription.findMany({ where: { customerId: id, status: "ACTIVE" }, select: { productId: true } }),
  ]);

  if (!customer) notFound();

  // A product managed by an active subscription is no longer a manual refill.
  const subscribedProductIds = new Set(activeSubs.map((s) => s.productId));
  const visiblePredictions = predictions.filter((p) => !subscribedProductIds.has(p.productId));

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

      {/* Membership */}
      {member && (
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Membership</h2>
            {member.memberStatus === "PROSPECT" && (
              <form action={claimMembershipAction}>
                <input type="hidden" name="customerId" value={id} />
                <button className="bg-slate-900 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-slate-800">
                  Claim membership
                </button>
              </form>
            )}
          </div>

          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
            <div>
              <dt className="text-slate-400">Status</dt>
              <dd>
                <span
                  className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                    member.memberStatus === "ACTIVE"
                      ? "bg-emerald-100 text-emerald-700"
                      : member.memberStatus === "LAPSED"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {member.memberStatus}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Tier</dt>
              <dd className="flex items-center gap-1.5 text-slate-800">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: member.tier.color }} />
                {member.tier.name}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Member #</dt>
              <dd className="font-mono text-slate-800">{member.memberId ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Member since</dt>
              <dd className="text-slate-800">{member.joinDate ? fmtDate(member.joinDate) : "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Lifetime spend</dt>
              <dd className="text-slate-800">{rm(member.lifetimeSpend)}</dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-slate-400">Points</dt>
              <dd className="flex items-center gap-2 text-slate-800">
                {member.pointsBalance}
                <form action={adjustPoints} className="inline-flex items-center gap-1">
                  <input type="hidden" name="customerId" value={id} />
                  <input
                    name="delta"
                    type="number"
                    defaultValue={10}
                    className="w-16 rounded border border-slate-200 px-1.5 py-0.5 text-xs"
                  />
                  <button className="rounded border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                    Apply
                  </button>
                </form>
              </dd>
            </div>
          </dl>

          {member.posLoyaltyPoints != null && member.posLoyaltyPoints !== member.pointsBalance && (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              StoreHub loyalty shows <strong>{member.posLoyaltyPoints}</strong> pts vs the CRM&apos;s{" "}
              <strong>{member.pointsBalance}</strong>. Review before relying on either — the CRM&apos;s computed tier is the source of truth.
            </div>
          )}
        </div>
      )}

      {/* Action needed — this customer's open inbox items (only shown if any) */}
      {actions.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-amber-100 bg-amber-50">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                Action needed
                <span className="text-xs font-medium bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
                  {actions.length}
                </span>
              </h2>
              <p className="text-xs text-slate-500">Open inbox items for this customer · soonest first</p>
            </div>
            <Link href="/" className="text-xs text-slate-500 hover:underline whitespace-nowrap">
              Open inbox →
            </Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {actions.map((item) => (
              <InboxRow key={item.key} item={item} />
            ))}
          </ul>
        </div>
      )}

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
          {visiblePredictions.length === 0 ? (
            <p className="text-sm text-slate-400">
              {predictions.length === 0 ? "No consumable purchases yet." : "All consumables are managed by subscriptions."}
            </p>
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
                {visiblePredictions.map((p) => (
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
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">
            Purchase history ({customer.transactions.length})
          </h2>
        </div>

        <div className="mb-4">
          <LinkTransactionForm customerId={id} />
        </div>

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
                  <span className="flex items-center gap-3">
                    <span className="text-slate-600">{rm(t.totalAmount)}</span>
                    <form action={unlinkTransaction}>
                      <input type="hidden" name="transactionId" value={t.id} />
                      <input type="hidden" name="customerId" value={id} />
                      <button
                        className="text-xs text-slate-400 hover:text-red-600 hover:underline"
                        title="Detach this transaction from the customer"
                      >
                        Unlink
                      </button>
                    </form>
                  </span>
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
