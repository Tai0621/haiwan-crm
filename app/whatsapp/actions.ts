"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { parseWhatsAppExport } from "@/lib/whatsapp/parse";
import { ingestMessages } from "@/lib/whatsapp/ingest";
import { runEodAnalysis, type AnalysisSummary } from "@/lib/whatsapp/analyze";
import type { IncomingMessage, IngestSummary } from "@/lib/whatsapp/types";

// ---------------------------------------------------------------------------
// Ingest a pasted WhatsApp chat export.
//   text        — the raw exported .txt contents
//   phone       — the customer's phone (export has names, not numbers)
//   usSenders   — sender display-name(s) that are Haiwan ("us"); their messages
//                 are stored OUTBOUND, everyone else INBOUND
// Re-parsed here so the server is the source of truth.
// ---------------------------------------------------------------------------
export async function ingestPastedChat(
  text: string,
  phone: string,
  usSenders: string[],
): Promise<IngestSummary> {
  if (!text.trim()) {
    return { inserted: 0, skippedDuplicate: 0, customersMatched: 0, customersCreated: 0, errors: ["Nothing pasted."] };
  }
  if (!phone.trim()) {
    return { inserted: 0, skippedDuplicate: 0, customersMatched: 0, customersCreated: 0, errors: ["Customer phone is required."] };
  }

  const us = new Set(usSenders.map((s) => s.trim()).filter(Boolean));
  const { entries } = parseWhatsAppExport(text);

  const messages: IncomingMessage[] = entries.map((e) => ({
    phone,
    contactName: us.has(e.sender) ? undefined : e.sender,
    direction: us.has(e.sender) ? "OUTBOUND" : "INBOUND",
    body: e.body,
    timestamp: e.timestamp,
  }));

  const summary = await ingestMessages(messages, "MANUAL");
  revalidatePath("/whatsapp");
  revalidatePath("/customers");
  return summary;
}

// ---------------------------------------------------------------------------
// Run the end-of-day analysis on demand.
//   dateStr — optional "YYYY-MM-DD" to restrict to one day; omit for the whole
//             unanalysed backlog.
// ---------------------------------------------------------------------------
export async function runAnalysis(dateStr?: string): Promise<AnalysisSummary> {
  const date = dateStr ? new Date(dateStr + "T00:00:00") : undefined;
  const summary = await runEodAnalysis(date ? { date } : {});
  revalidatePath("/whatsapp");
  revalidatePath("/");
  return summary;
}

// ---------------------------------------------------------------------------
// Review-queue actions.
// ---------------------------------------------------------------------------
export async function reviewLead(formData: FormData) {
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as "CONFIRMED" | "DISMISSED" | "PENDING";
  await prisma.whatsAppLead.update({
    where: { id },
    data: { status, reviewedAt: status === "PENDING" ? null : new Date() },
  });
  revalidatePath("/whatsapp");
}
