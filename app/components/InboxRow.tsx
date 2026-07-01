"use client";

import Link from "next/link";
import { formatPhoneDisplay } from "@/lib/phone";
import Countdown from "./Countdown";
import {
  markTaskDone,
  snoozeTask,
  markRefillDone,
  snoozeRefill,
} from "@/app/actions/tasks";
import { convertRefillToSubscription } from "@/app/subscriptions/actions";
import type { InboxItem } from "@/lib/tasks";

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

const TYPE_STYLES: Record<string, string> = {
  REFILL: "bg-emerald-100 text-emerald-700",
  LEAD_FOLLOWUP: "bg-blue-100 text-blue-700",
  INQUIRY: "bg-slate-100 text-slate-600",
  HOLD: "bg-amber-100 text-amber-700",
  ACTIVATION: "bg-violet-100 text-violet-700",
  WINBACK: "bg-rose-100 text-rose-700",
  SUBSCRIPTION_DUE: "bg-teal-100 text-teal-700",
  BRAND_REVIEW: "bg-indigo-100 text-indigo-700",
  CUSTOM: "bg-slate-100 text-slate-600",
};

function dueLabel(item: InboxItem): string {
  if (item.isOverdue) {
    const d = Math.abs(item.daysUntilDue);
    return d === 0 ? "Overdue" : `${d}d overdue`;
  }
  if (item.daysUntilDue <= 0) return "Due today";
  return `Due in ${item.daysUntilDue}d`;
}

export default function InboxRow({ item }: { item: InboxItem }) {
  const isHold = item.holdExpiresAt != null;

  // Hidden-field set that identifies this row to the snooze/done actions.
  const idFields =
    item.kind === "task" ? (
      <input type="hidden" name="taskId" value={item.taskId} />
    ) : (
      <>
        <input type="hidden" name="customerId" value={item.customerId ?? ""} />
        <input type="hidden" name="productId" value={item.refillProductId ?? ""} />
        <input
          type="hidden"
          name="cycleDate"
          value={item.refillCycleDate ? new Date(item.refillCycleDate).toISOString() : ""}
        />
      </>
    );

  const doneAction = item.kind === "task" ? markTaskDone : markRefillDone;
  const snoozeAction = item.kind === "task" ? snoozeTask : snoozeRefill;

  return (
    <li className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TYPE_STYLES[item.type] ?? TYPE_STYLES.CUSTOM}`}>
            {TYPE_LABELS[item.type] ?? "Task"}
          </span>
          <span className="truncate font-medium text-slate-900">
            {item.brandName ?? item.customerName ?? "Unnamed"}
          </span>
          {item.petLabel && <span className="text-sm text-slate-500">· {item.petLabel}</span>}
          {item.customerPhone && (
            <span className="font-mono text-xs text-slate-400">{formatPhoneDisplay(item.customerPhone)}</span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-slate-600">
          {item.reason}
          {item.note ? <span className="text-slate-400"> — {item.note}</span> : null}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
          {isHold ? (
            <Countdown expiresAt={item.holdExpiresAt as Date} />
          ) : (
            <span className={item.isOverdue ? "font-medium text-red-600" : "text-slate-500"}>{dueLabel(item)}</span>
          )}
          {item.store !== "NONE" && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{item.store}</span>
          )}
          {item.channel !== "SYSTEM" && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{item.channel.toLowerCase()}</span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        {item.whatsappUrl && (
          <a
            href={item.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700"
          >
            WhatsApp
          </a>
        )}
        {item.customerId && (
          <Link
            href={`/customers/${item.customerId}`}
            className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Open
          </Link>
        )}
        {item.brandId && (
          <Link
            href={`/brands/${item.brandId}`}
            className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Open brand
          </Link>
        )}

        {item.kind === "refill" && item.customerId && item.refillProductId && (
          <form action={convertRefillToSubscription} className="inline">
            <input type="hidden" name="customerId" value={item.customerId} />
            <input type="hidden" name="productId" value={item.refillProductId} />
            <input type="hidden" name="intervalDays" value={item.refillIntervalDays ?? 30} />
            <input
              type="hidden"
              name="nextDueDate"
              value={item.refillCycleDate ? new Date(item.refillCycleDate).toISOString() : ""}
            />
            <button
              title="Convert this refill into a managed subscription"
              className="rounded border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700 hover:bg-teal-100"
            >
              Subscribe
            </button>
          </form>
        )}

        <form action={doneAction} className="inline">
          {idFields}
          <button className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
            Done
          </button>
        </form>

        <form action={snoozeAction} className="inline-flex items-center overflow-hidden rounded border border-slate-200">
          {idFields}
          <span className="px-1.5 text-[10px] text-slate-400">Snooze</span>
          {[1, 3, 7].map((d) => (
            <button
              key={d}
              name="days"
              value={d}
              className="border-l border-slate-200 px-1.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              {d}d
            </button>
          ))}
        </form>
      </div>
    </li>
  );
}
