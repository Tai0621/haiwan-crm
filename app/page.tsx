import Link from "next/link";
import { prisma } from "@/lib/db";
import { getInbox, sweepExpiredHolds, type InboxItem } from "@/lib/tasks";
import { reconcileMemberships } from "@/lib/membership";
import { reconcileSubscriptions, estimatedMrr } from "@/lib/subscriptions";
import { reconcileBrandTrials } from "@/lib/brands";
import { currentRole } from "@/lib/auth";
import { rm } from "@/lib/format";
import InboxRow from "@/app/components/InboxRow";
import QuickAdd from "@/app/components/QuickAdd";
import type { Store, TaskType } from "@/app/generated/prisma/client";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  REFILL: "Refill",
  LEAD_FOLLOWUP: "Lead",
  INQUIRY: "Inquiry",
  HOLD: "Hold",
  ACTIVATION: "Activation",
  WINBACK: "Win-back",
  SUBSCRIPTION_DUE: "Subscription",
  BRAND_REVIEW: "Brand review",
  CUSTOM: "Task",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; type?: string }>;
}) {
  const sp = await searchParams;
  const storeFilter = (sp.store as Store | "ALL") || "ALL";
  const typeFilter = (sp.type as TaskType | "ALL") || "ALL";

  // Flip lapsed 24h holds to EXPIRED (+ courtesy follow-ups), lapse quiet members
  // (+ WINBACK tasks), and raise SUBSCRIPTION_DUE tasks for due subscriptions,
  // before reading the inbox so the list reflects the latest state on every load.
  await Promise.all([
    sweepExpiredHolds(),
    reconcileMemberships(),
    reconcileSubscriptions(),
    reconcileBrandTrials(),
  ]);

  const [inbox, activeSubs, mrr, role] = await Promise.all([
    getInbox(), // unfiltered — drives counts + the available filter pills
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    estimatedMrr(),
    currentRole(),
  ]);
  // Frontline staff don't handle brand-trial reviews — hide them from their inbox.
  const all = role === "frontline" ? inbox.filter((i) => i.type !== "BRAND_REVIEW") : inbox;

  const overdue = all.filter((i) => i.isOverdue).length;
  const presentTypes = Array.from(new Set(all.map((i) => i.type)));

  const items = all.filter(
    (i) =>
      (storeFilter === "ALL" || i.store === storeFilter) &&
      (typeFilter === "ALL" || i.type === typeFilter),
  );

  const qs = (next: { store?: string; type?: string }) => {
    const p = new URLSearchParams();
    const store = next.store ?? (storeFilter !== "ALL" ? storeFilter : "");
    const type = next.type ?? (typeFilter !== "ALL" ? typeFilter : "");
    if (store && store !== "ALL") p.set("store", store);
    if (type && type !== "ALL") p.set("type", type);
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Action Inbox</h1>
        <p className="text-sm text-slate-500">What to do now — Haiwan, another parent to every pet.</p>
      </div>

      {/* Headline counts */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="To action now" value={all.length} accent={all.length ? undefined : "muted"} />
        <StatCard label="Overdue" value={overdue} accent={overdue ? "red" : "muted"} />
        <StatCard label="Active subscriptions" value={activeSubs} href="/subscriptions" />
        <StatCard label="Recurring / mo" value={rm(mrr)} href="/subscriptions" accent="emerald" />
      </div>

      <QuickAdd />

      {/* Inbox */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">To action now</h2>
            <p className="text-xs text-slate-400">
              {items.length} of {all.length} item{all.length === 1 ? "" : "s"} · soonest due first
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <FilterPill href={qs({ store: "ALL" })} active={storeFilter === "ALL"} label="All stores" />
            <FilterPill href={qs({ store: "KL" })} active={storeFilter === "KL"} label="KL" />
            <FilterPill href={qs({ store: "PJ" })} active={storeFilter === "PJ"} label="PJ" />
          </div>
        </div>

        {presentTypes.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-4 py-2 text-xs">
            <FilterPill href={qs({ type: "ALL" })} active={typeFilter === "ALL"} label="All types" />
            {presentTypes.map((t) => (
              <FilterPill key={t} href={qs({ type: t })} active={typeFilter === t} label={TYPE_LABELS[t] ?? t} />
            ))}
          </div>
        )}

        {items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">
            {all.length === 0 ? "Nothing to action — you're all caught up. 🐾" : "No items match this filter."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((item: InboxItem) => (
              <InboxRow key={item.key} item={item} />
            ))}
          </ul>
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
  value: number | string;
  href?: string;
  accent?: "amber" | "red" | "muted" | "emerald";
}) {
  const color =
    accent === "amber"
      ? "text-amber-600"
      : accent === "red"
        ? "text-red-600"
        : accent === "emerald"
          ? "text-emerald-600"
          : accent === "muted"
            ? "text-slate-400"
            : "text-slate-900";
  const inner = (
    <div className="rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function FilterPill({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
        active ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
      }`}
    >
      {label}
    </Link>
  );
}
