import Link from "next/link";
import { prisma } from "@/lib/db";
import { dueSoonPredictions } from "@/lib/refill";
import { formatPhoneDisplay, whatsappLink } from "@/lib/phone";
import { fmtDate } from "@/lib/format";
import { REFILL_WINDOW_DAYS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [totalCustomers, needsDetails, activeSubs, due] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.count({ where: { needsDetails: true } }),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    dueSoonPredictions(),
  ]);

  const waMessage = (name: string | null, product: string, pets: string[]) => {
    const who = pets.length ? `${pets.join(" & ")}'s` : "your pet's";
    return `Hi${name ? " " + name : ""}! This is Haiwan. We think ${who} ${product} may be running low soon — would you like us to set aside a refill?`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Haiwan — another parent to every pet.</p>
      </div>

      {/* Headline counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total customers" value={totalCustomers} href="/customers" />
        <StatCard label="Needs details" value={needsDetails} href="/customers?needs=1" accent="amber" />
        <StatCard label="Due to contact" value={due.length} accent="red" />
        <StatCard label="Active subscriptions" value={activeSubs} href="/subscriptions" />
      </div>

      {/* To contact this week */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-1">To contact this week</h2>
        <p className="text-xs text-slate-400 mb-4">
          Consumables predicted to run out within {REFILL_WINDOW_DAYS} days · soonest first
        </p>

        {due.length === 0 ? (
          <p className="text-sm text-slate-400">Nothing due soon.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left text-xs">
                <tr>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">Pet(s)</th>
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 font-medium">Last bought</th>
                  <th className="px-3 py-2 font-medium">Predicted due</th>
                  <th className="px-3 py-2 font-medium text-right">Days</th>
                  <th className="px-3 py-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {due.map((d) => {
                  const wa = whatsappLink(d.customerPhone, waMessage(d.customerName, d.productName, d.petNames));
                  return (
                    <tr key={`${d.customerId}-${d.productId}`} className="hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <Link href={`/customers/${d.customerId}`} className="font-medium text-slate-900 hover:underline">
                          {d.customerName ?? "Unnamed"}
                        </Link>
                        <div className="text-xs text-slate-400 font-mono">
                          {formatPhoneDisplay(d.customerPhone)}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{d.petNames.join(", ") || "—"}</td>
                      <td className="px-3 py-2 text-slate-700">
                        {d.productName}
                        {d.basis === "category-default" && (
                          <span className="ml-1 text-[10px] text-slate-400">(est.)</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-500">{fmtDate(d.lastPurchaseDate)}</td>
                      <td className="px-3 py-2 text-slate-700">{fmtDate(d.predictedNextDate)}</td>
                      <td
                        className={`px-3 py-2 text-right font-medium ${
                          d.daysUntilDue < 0 ? "text-red-600" : d.daysUntilDue <= 2 ? "text-orange-600" : "text-slate-600"
                        }`}
                      >
                        {d.daysUntilDue < 0 ? `${Math.abs(d.daysUntilDue)}d overdue` : `${d.daysUntilDue}d`}
                      </td>
                      <td className="px-3 py-2 text-right">
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
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
  accent,
}: {
  label: string;
  value: number;
  href?: string;
  accent?: "amber" | "red";
}) {
  const color =
    accent === "amber" ? "text-amber-600" : accent === "red" ? "text-red-600" : "text-slate-900";
  const inner = (
    <div className="bg-white border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-sm text-slate-500 mt-1">{label}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
