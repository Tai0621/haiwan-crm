import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { predictionsForPet } from "@/lib/refill";
import { petAnalytics, effectiveStage, pct } from "@/lib/analytics";
import { whatsappLink, formatPhoneDisplay } from "@/lib/phone";
import { fmtDate, fmtDateTime, rm } from "@/lib/format";
import {
  SPECIES_LABELS,
  LIFESTAGE_LABELS,
  SUPPLIER_LABELS,
  SUPPLIER_COLORS,
  SUBSCRIPTION_STATUS_LABELS,
  REFILL_WINDOW_DAYS,
} from "@/lib/constants";
import PetAvatar from "@/app/components/PetAvatar";

export const dynamic = "force-dynamic";

function ageLabel(dob: Date | null, approx: number | null): string {
  let months = approx;
  if (months == null && dob) {
    months = Math.floor((Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
  }
  if (months == null) return "Unknown";
  if (months < 12) return `${months} months`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem ? `${years} yr ${rem} mo` : `${years} yr`;
}

export default async function PetProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const pet = await prisma.pet.findUnique({
    where: { id },
    include: { customer: { select: { id: true, name: true, phone: true } } },
  });
  if (!pet) notFound();

  const [analytics, predictions, lines, subscriptions] = await Promise.all([
    petAnalytics(id),
    predictionsForPet(id),
    prisma.transactionLine.findMany({
      where: { petId: id },
      orderBy: { transaction: { transactionDate: "desc" } },
      include: {
        product: { select: { name: true, supplierType: true } },
        transaction: { select: { id: true, transactionDate: true, store: true } },
      },
    }),
    prisma.subscription.findMany({
      where: { petId: id },
      orderBy: [{ status: "asc" }, { nextDueDate: "asc" }],
      include: { product: { select: { name: true } } },
    }),
  ]);

  const stage = effectiveStage(pet);
  const wa = whatsappLink(pet.customer.phone);
  const dueSoon = predictions.filter((p) => p.daysUntilDue <= REFILL_WINDOW_DAYS);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/pets" className="text-sm text-slate-500 hover:underline">
          ← All pets
        </Link>
      </div>

      {/* ---- Hero header ---- */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex justify-between items-start gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <PetAvatar name={pet.name} photoUrl={pet.photoUrl} size="xl" />
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{pet.name}</h1>
              <p className="text-slate-500 mt-1">
                {SPECIES_LABELS[pet.species]}
                {pet.breed && ` · ${pet.breed}`}
                {pet.sex && ` · ${pet.sex === "MALE" ? "Male" : pet.sex === "FEMALE" ? "Female" : "Sex unknown"}`}
                {pet.neutered && " · neutered"}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="inline-block text-xs uppercase tracking-wide bg-slate-100 text-slate-700 px-2 py-1 rounded">
              {LIFESTAGE_LABELS[pet.lifeStage ?? stage] ?? "Stage unknown"}
            </span>
            {dueSoon.length > 0 && (
              <div className="mt-2 text-xs text-red-600 font-medium">
                {dueSoon.length} refill{dueSoon.length > 1 ? "s" : ""} due soon
              </div>
            )}
          </div>
        </div>

        {/* Key facts grid */}
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 text-sm">
          <Fact label="Age" value={ageLabel(pet.dateOfBirth, pet.approxAgeMonths)} />
          <Fact label="Date of birth" value={pet.dateOfBirth ? fmtDate(pet.dateOfBirth) : "—"} />
          <Fact label="Weight" value={pet.weightKg != null ? `${pet.weightKg} kg` : "—"} />
          <Fact label="Gotcha day" value={pet.adoptionDate ? fmtDate(pet.adoptionDate) : "—"} />
          <Fact label="Colour / markings" value={pet.colorMarkings ?? "—"} />
          <Fact label="Microchip" value={pet.microchipId ?? "—"} mono />
          <Fact label="Vet / clinic" value={pet.vetName ?? "—"} />
          <Fact
            label="Parent"
            value={
              <Link href={`/customers/${pet.customer.id}`} className="text-slate-900 hover:underline">
                {pet.customer.name ?? "Unnamed"}
              </Link>
            }
          />
        </dl>

        <div className="flex gap-2 mt-5">
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-green-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-green-700"
            >
              WhatsApp {pet.customer.name?.split(" ")[0] ?? "parent"}
            </a>
          )}
          <Link
            href={`/customers/${pet.customer.id}`}
            className="bg-slate-200 text-slate-800 px-3 py-2 rounded-md text-sm font-medium hover:bg-slate-300"
          >
            Edit on parent profile
          </Link>
        </div>
      </div>

      {/* ---- Health & diet ---- */}
      {(pet.allergies || pet.dietaryNotes || pet.notes) && (
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-3">Health &amp; care</h2>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            {pet.allergies && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 mb-1">Allergies</div>
                <div className="text-amber-900">{pet.allergies}</div>
              </div>
            )}
            {pet.dietaryNotes && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Dietary notes</div>
                <div className="text-slate-700">{pet.dietaryNotes}</div>
              </div>
            )}
            {pet.notes && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Notes</div>
                <div className="text-slate-700">{pet.notes}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- Spend snapshot ---- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Lifetime spend" value={rm(analytics.totalSpend)} />
        <Stat label="Visits" value={String(analytics.distinctVisits)} />
        <Stat label="First seen" value={analytics.firstPurchase ? fmtDate(analytics.firstPurchase) : "—"} />
        <Stat label="Last seen" value={analytics.lastPurchase ? fmtDate(analytics.lastPurchase) : "—"} />
      </div>

      {/* ---- Refill predictions + Margin mix ---- */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-1">Refill predictions</h2>
          <p className="text-xs text-slate-400 mb-3">
            Consumables bought for {pet.name}, by repurchase interval
          </p>
          {predictions.length === 0 ? (
            <p className="text-sm text-slate-400">No consumables attributed to {pet.name} yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-slate-400 text-left text-xs">
                <tr>
                  <th className="py-1 font-medium">Product</th>
                  <th className="py-1 font-medium">Next due</th>
                  <th className="py-1 font-medium text-right">Days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {predictions.map((p) => (
                  <tr key={p.productId}>
                    <td className="py-1.5 text-slate-700">{p.productName}</td>
                    <td className="py-1.5 text-slate-700">{fmtDate(p.predictedNextDate)}</td>
                    <td
                      className={`py-1.5 text-right font-medium ${
                        p.daysUntilDue <= REFILL_WINDOW_DAYS ? "text-red-600" : "text-slate-500"
                      }`}
                    >
                      {p.daysUntilDue < 0 ? `${Math.abs(p.daysUntilDue)}d overdue` : `${p.daysUntilDue}d`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-1">Margin mix</h2>
          <p className="text-xs text-slate-400 mb-3">Spend on {pet.name} by supplier type</p>
          {analytics.mix.total === 0 ? (
            <p className="text-sm text-slate-400">No spend attributed yet.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex h-6 rounded-md overflow-hidden">
                {(["INHOUSE", "CONSIGNMENT", "TRADING", "UNCLASSIFIED"] as const).map((k) =>
                  analytics.mix[k] > 0 ? (
                    <div
                      key={k}
                      style={{ width: `${pct(analytics.mix[k], analytics.mix.total)}%`, backgroundColor: SUPPLIER_COLORS[k] }}
                      title={`${SUPPLIER_LABELS[k] ?? k}: ${rm(analytics.mix[k])}`}
                    />
                  ) : null,
                )}
              </div>
              <ul className="text-sm space-y-1">
                {(["INHOUSE", "CONSIGNMENT", "TRADING", "UNCLASSIFIED"] as const).map((k) =>
                  analytics.mix[k] > 0 ? (
                    <li key={k} className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: SUPPLIER_COLORS[k] }} />
                        {SUPPLIER_LABELS[k] ?? "Unclassified"}
                      </span>
                      <span className="text-slate-600">
                        {rm(analytics.mix[k])} ({pct(analytics.mix[k], analytics.mix.total)}%)
                      </span>
                    </li>
                  ) : null,
                )}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* ---- Category breakdown + Top products ---- */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-3">Spend by category</h2>
          {analytics.categorySpend.length === 0 ? (
            <p className="text-sm text-slate-400">No data.</p>
          ) : (
            <ul className="space-y-2">
              {analytics.categorySpend.map((c) => (
                <li key={c.category}>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-700 capitalize">{c.category}</span>
                    <span className="text-slate-500">{rm(c.amount)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded mt-1 overflow-hidden">
                    <div
                      className="h-full bg-slate-700 rounded"
                      style={{ width: `${pct(c.amount, analytics.totalSpend)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-3">Top products</h2>
          {analytics.topProducts.length === 0 ? (
            <p className="text-sm text-slate-400">No data.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-slate-400 text-left text-xs">
                <tr>
                  <th className="py-1 font-medium">Product</th>
                  <th className="py-1 font-medium text-right">Qty</th>
                  <th className="py-1 font-medium text-right">Spend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analytics.topProducts.slice(0, 8).map((p, i) => (
                  <tr key={i}>
                    <td className="py-1.5 text-slate-700">
                      {p.name}
                      {p.supplierType && (
                        <span
                          className="ml-2 text-[10px] uppercase px-1 py-0.5 rounded"
                          style={{
                            backgroundColor: SUPPLIER_COLORS[p.supplierType] + "22",
                            color: SUPPLIER_COLORS[p.supplierType],
                          }}
                        >
                          {SUPPLIER_LABELS[p.supplierType]}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 text-right text-slate-500">{p.qty}</td>
                    <td className="py-1.5 text-right text-slate-700">{rm(p.spend)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ---- Subscriptions (this pet) ---- */}
      {subscriptions.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Subscriptions</h2>
            <Link href="/subscriptions" className="text-xs text-slate-500 hover:underline">
              Manage →
            </Link>
          </div>
          <table className="w-full text-sm">
            <thead className="text-slate-400 text-left text-xs">
              <tr>
                <th className="py-1 font-medium">Product</th>
                <th className="py-1 font-medium text-right">Every</th>
                <th className="py-1 font-medium">Next due</th>
                <th className="py-1 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subscriptions.map((s) => (
                <tr key={s.id}>
                  <td className="py-1.5 text-slate-700">{s.product.name}</td>
                  <td className="py-1.5 text-right text-slate-500">{s.intervalDays}d</td>
                  <td className="py-1.5 text-slate-700">{fmtDate(s.nextDueDate)}</td>
                  <td className="py-1.5">
                    <span
                      className={`text-[10px] uppercase font-medium px-2 py-0.5 rounded ${
                        s.status === "ACTIVE"
                          ? "bg-green-100 text-green-700"
                          : s.status === "PAUSED"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {SUBSCRIPTION_STATUS_LABELS[s.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---- Purchase history (this pet) ---- */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-3">
          Purchase history for {pet.name} ({lines.length} line{lines.length === 1 ? "" : "s"})
        </h2>
        {lines.length === 0 ? (
          <p className="text-sm text-slate-400">Nothing attributed to {pet.name} yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left text-xs">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 font-medium text-right">Qty</th>
                <th className="px-3 py-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-500">{fmtDateTime(l.transaction.transactionDate)}</td>
                  <td className="px-3 py-2 text-slate-700">
                    {l.product?.name ?? <span className="text-amber-600">{l.rawProductName}</span>}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-500">{l.quantity}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{rm(l.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Fact({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-slate-400 text-xs">{label}</dt>
      <dd className={`text-slate-800 ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-sm text-slate-500 mt-1">{label}</div>
    </div>
  );
}
