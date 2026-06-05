import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { SUBSCRIPTION_STATUS_LABELS } from "@/lib/constants";
import { formatPhoneDisplay } from "@/lib/phone";
import NewSubscriptionForm from "./NewSubscriptionForm";
import { updateSubscriptionStatus, deleteSubscription } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  PAUSED: "bg-amber-100 text-amber-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};

export default async function SubscriptionsPage() {
  const [subs, customers, products] = await Promise.all([
    prisma.subscription.findMany({
      orderBy: [{ status: "asc" }, { nextDueDate: "asc" }],
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        pet: { select: { name: true } },
        product: { select: { name: true } },
      },
    }),
    prisma.customer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true, pets: { select: { id: true, name: true } } },
    }),
    prisma.product.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, isConsumable: true },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Subscriptions</h1>
        <p className="text-sm text-slate-500">
          Recurring order intents. Basic tracking — billing is handled elsewhere.
        </p>
      </div>

      <NewSubscriptionForm customers={customers} products={products} />

      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left text-xs">
            <tr>
              <th className="px-3 py-2 font-medium">Customer</th>
              <th className="px-3 py-2 font-medium">Pet</th>
              <th className="px-3 py-2 font-medium">Product</th>
              <th className="px-3 py-2 font-medium text-right">Every</th>
              <th className="px-3 py-2 font-medium">Next due</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {subs.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-3 py-2">
                  <Link href={`/customers/${s.customer.id}`} className="font-medium text-slate-900 hover:underline">
                    {s.customer.name ?? "Unnamed"}
                  </Link>
                  <div className="text-xs text-slate-400 font-mono">{formatPhoneDisplay(s.customer.phone)}</div>
                </td>
                <td className="px-3 py-2 text-slate-600">{s.pet?.name ?? "—"}</td>
                <td className="px-3 py-2 text-slate-700">{s.product.name}</td>
                <td className="px-3 py-2 text-right text-slate-600">{s.intervalDays}d</td>
                <td className="px-3 py-2 text-slate-700">{fmtDate(s.nextDueDate)}</td>
                <td className="px-3 py-2">
                  <span className={`text-[10px] uppercase font-medium px-2 py-0.5 rounded ${STATUS_STYLES[s.status]}`}>
                    {SUBSCRIPTION_STATUS_LABELS[s.status]}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1 justify-end items-center">
                    {/* Quick status switch */}
                    <form action={updateSubscriptionStatus}>
                      <input type="hidden" name="id" value={s.id} />
                      {s.status !== "ACTIVE" && (
                        <button name="status" value="ACTIVE" className="text-xs text-green-700 hover:underline px-1">
                          Activate
                        </button>
                      )}
                    </form>
                    <form action={updateSubscriptionStatus}>
                      <input type="hidden" name="id" value={s.id} />
                      {s.status === "ACTIVE" && (
                        <button name="status" value="PAUSED" className="text-xs text-amber-700 hover:underline px-1">
                          Pause
                        </button>
                      )}
                    </form>
                    <form action={updateSubscriptionStatus}>
                      <input type="hidden" name="id" value={s.id} />
                      {s.status !== "CANCELLED" && (
                        <button name="status" value="CANCELLED" className="text-xs text-slate-500 hover:underline px-1">
                          Cancel
                        </button>
                      )}
                    </form>
                    <form action={deleteSubscription}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className="text-xs text-red-600 hover:underline px-1">Delete</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {subs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  No subscriptions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
