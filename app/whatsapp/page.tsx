import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { formatPhoneDisplay } from "@/lib/phone";
import { LEAD_TYPE_LABELS, LEAD_TYPE_STYLES } from "@/lib/constants";
import RunAnalysisButton from "./RunAnalysisButton";
import { reviewLead } from "./actions";

export const dynamic = "force-dynamic";

type LeadItem = {
  productName?: string;
  quantity?: number | string | null;
  matchedSku?: string | null;
};

function parseItems(json: string | null): LeadItem[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export default async function WhatsAppPage() {
  const [totalMessages, unanalyzedInbound, pendingLeads, recentReviewed] = await Promise.all([
    prisma.whatsAppMessage.count(),
    prisma.whatsAppMessage.count({ where: { analyzedAt: null, direction: "INBOUND" } }),
    prisma.whatsAppLead.findMany({
      where: { status: "PENDING" },
      orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
      include: { customer: { select: { id: true, name: true } } },
    }),
    prisma.whatsAppLead.findMany({
      where: { status: { not: "PENDING" } },
      orderBy: { reviewedAt: "desc" },
      take: 8,
      include: { customer: { select: { id: true, name: true } } },
    }),
  ]);

  const apiKeySet = !!process.env.ANTHROPIC_API_KEY?.trim();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">WhatsApp</h1>
          <p className="text-sm text-slate-500">
            Messages are analyzed for orders, refills and purchase intent. Confirmed leads feed the team.
          </p>
        </div>
        <Link
          href="/whatsapp/import"
          className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-700"
        >
          + Import chat
        </Link>
      </div>

      {/* Connection / mode status */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900 space-y-1">
        <p className="font-medium">Manual mode</p>
        <p className="text-amber-800">
          No live WhatsApp connection yet — bring messages in via{" "}
          <Link href="/whatsapp/import" className="underline font-medium">
            Import chat
          </Link>
          . The ingestion layer is pluggable, so a live source (official Cloud API, a bridge, or a
          provider) can be wired in later without changing analysis or this queue.
        </p>
        {!apiKeySet && (
          <p className="text-amber-800">
            ⚠️ <strong>ANTHROPIC_API_KEY is not set.</strong> Add it to the app&apos;s{" "}
            <code className="bg-amber-100 px-1 rounded">.env</code> and restart to enable analysis.
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Messages stored" value={totalMessages} />
        <Stat label="Awaiting analysis" value={unanalyzedInbound} />
        <Stat label="Leads to review" value={pendingLeads.length} />
        <Stat label="Analysis" value={apiKeySet ? "Ready" : "Off"} muted={!apiKeySet} />
      </div>

      {/* Run analysis */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">End-of-day analysis</h2>
        <RunAnalysisButton unanalyzed={unanalyzedInbound} />
        <p className="text-xs text-slate-400 mt-2">
          Runs on demand for now. Once deployed to an always-on host, this same routine can be
          scheduled to fire automatically every evening.
        </p>
      </div>

      {/* Review queue */}
      <div>
        <h2 className="text-sm font-semibold text-slate-900 mb-2">
          Review queue
          <span className="ml-2 text-xs font-normal text-slate-400">
            ({pendingLeads.length} pending)
          </span>
        </h2>
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left text-xs">
              <tr>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Customer</th>
                <th className="px-3 py-2 font-medium">Summary</th>
                <th className="px-3 py-2 font-medium">Items</th>
                <th className="px-3 py-2 font-medium text-right">Conf.</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendingLeads.map((lead) => {
                const items = parseItems(lead.itemsJson);
                return (
                  <tr key={lead.id} className="hover:bg-slate-50 align-top">
                    <td className="px-3 py-2.5">
                      <span
                        className={`text-[10px] uppercase font-medium px-2 py-0.5 rounded ${
                          LEAD_TYPE_STYLES[lead.type] ?? "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {LEAD_TYPE_LABELS[lead.type] ?? lead.type}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {lead.customer ? (
                        <Link
                          href={`/customers/${lead.customer.id}`}
                          className="font-medium text-slate-900 hover:underline"
                        >
                          {lead.customer.name ?? "Unnamed"}
                        </Link>
                      ) : (
                        <span className="text-slate-500">{lead.contactName ?? "Unknown"}</span>
                      )}
                      <div className="text-xs text-slate-400 font-mono">
                        {formatPhoneDisplay(lead.phone)}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-700 max-w-sm">
                      {lead.summary}
                      {lead.evidence && (
                        <div className="text-xs text-slate-400 italic mt-0.5 line-clamp-2">
                          “{lead.evidence}”
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 text-xs">
                      {items.length > 0 ? (
                        <ul className="space-y-0.5">
                          {items.map((it, i) => (
                            <li key={i}>
                              {it.quantity ? `${it.quantity}× ` : ""}
                              {it.productName || "—"}
                              {it.matchedSku && (
                                <span className="text-green-600"> ✓ {it.matchedSku}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-500">
                      {Math.round(lead.confidence * 100)}%
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1 justify-end items-center">
                        <form action={reviewLead}>
                          <input type="hidden" name="id" value={lead.id} />
                          <button
                            name="status"
                            value="CONFIRMED"
                            className="text-xs text-green-700 hover:underline px-1"
                          >
                            Confirm
                          </button>
                        </form>
                        <form action={reviewLead}>
                          <input type="hidden" name="id" value={lead.id} />
                          <button
                            name="status"
                            value="DISMISSED"
                            className="text-xs text-slate-500 hover:underline px-1"
                          >
                            Dismiss
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {pendingLeads.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No leads to review. Import a chat and run the analysis.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recently reviewed */}
      {recentReviewed.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-900 mb-2">Recently reviewed</h2>
          <ul className="text-sm divide-y divide-slate-100 bg-white border border-slate-200 rounded-lg">
            {recentReviewed.map((lead) => (
              <li key={lead.id} className="px-3 py-2 flex items-center gap-3">
                <span
                  className={`text-[10px] uppercase font-medium px-2 py-0.5 rounded ${
                    LEAD_TYPE_STYLES[lead.type] ?? "bg-slate-100 text-slate-500"
                  }`}
                >
                  {LEAD_TYPE_LABELS[lead.type] ?? lead.type}
                </span>
                <span className="text-slate-700 flex-1 truncate">{lead.summary}</span>
                <span
                  className={`text-xs font-medium ${
                    lead.status === "CONFIRMED" ? "text-green-700" : "text-slate-400"
                  }`}
                >
                  {lead.status === "CONFIRMED" ? "Confirmed" : "Dismissed"}
                </span>
                <span className="text-xs text-slate-400 w-32 text-right">
                  {fmtDateTime(lead.reviewedAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, muted }: { label: string; value: number | string; muted?: boolean }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
      <div className={`text-2xl font-semibold ${muted ? "text-slate-400" : "text-slate-900"}`}>
        {value}
      </div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
