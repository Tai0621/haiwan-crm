// =============================================================================
// End-of-day WhatsApp analysis.
//
// Gathers unanalysed messages, groups them by customer, and asks Claude to
// extract structured "leads" — orders, refills, purchase intent, inquiries,
// complaints — which land in the staff review queue (WhatsAppLead).
//
// Talks to the Anthropic Messages API directly via fetch (no SDK dependency).
// Uses:
//   • prompt caching — the instructions + product catalog are sent as a cached
//     system block, reused across every per-customer call in the run, so only
//     the (small, varying) transcript is billed at full rate each time.
//   • a forced tool call (`record_leads`) for reliable structured output.
//
// Config (env):
//   ANTHROPIC_API_KEY          required; absent → returns a "not configured" result
//   WHATSAPP_ANALYSIS_MODEL    default "claude-haiku-4-5"
//   ANTHROPIC_BASE_URL         default "https://api.anthropic.com"
// =============================================================================

import { prisma } from "../db";
import { buildProductIndex, matchProduct } from "../match";
import type { LeadType } from "../../app/generated/prisma/client";

const API_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-haiku-4-5";
const LEAD_TYPES: LeadType[] = [
  "ORDER",
  "REFILL",
  "PURCHASE_INTENT",
  "INQUIRY",
  "COMPLAINT",
  "OTHER",
];

export interface AnalysisSummary {
  ok: boolean;
  reason?: string; // populated when ok === false (e.g. missing API key)
  customersAnalyzed: number;
  messagesAnalyzed: number;
  leadsCreated: number;
  errors: string[];
}

interface ModelLead {
  type: string;
  summary: string;
  items?: Array<{ productName?: string; quantity?: number | string }>;
  confidence?: number;
  evidence?: string;
}

const TOOL = {
  name: "record_leads",
  description:
    "Record every distinct buying signal or actionable item found in the customer's messages. " +
    "Return an empty list if the messages contain no order, purchase interest, refill request, " +
    "question, or complaint.",
  input_schema: {
    type: "object",
    properties: {
      leads: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: LEAD_TYPES,
              description:
                "ORDER = explicit request to buy/order. REFILL = top-up/restock of something they " +
                "already use. PURCHASE_INTENT = interested or asking price/availability, not yet " +
                "committed. INQUIRY = general question, no buying signal. COMPLAINT = problem to " +
                "follow up. OTHER = anything else worth a human's attention.",
            },
            summary: {
              type: "string",
              description: "One concise sentence a shop staffer can act on. Include product + quantity if stated.",
            },
            items: {
              type: "array",
              description: "Specific products mentioned, if any.",
              items: {
                type: "object",
                properties: {
                  productName: { type: "string" },
                  quantity: { type: ["number", "string"] },
                },
              },
            },
            confidence: {
              type: "number",
              description: "0..1 — how confident you are this is a real, actionable signal.",
            },
            evidence: {
              type: "string",
              description: "Short quote(s) from the customer's messages that justify this lead.",
            },
          },
          required: ["type", "summary", "confidence"],
        },
      },
    },
    required: ["leads"],
  },
} as const;

const SYSTEM_INSTRUCTIONS =
  "You analyse WhatsApp conversations for Haiwan, a Malaysian pet supplies retailer " +
  "(stores in KL and PJ; sells pet food, litter, treats, supplements and accessories). " +
  "Messages may mix English and Malay (e.g. 'nak order', 'ada stock?', 'berapa harga'). " +
  "Read the conversation and extract actionable buying signals for the shop staff using the " +
  "record_leads tool.\n\n" +
  "Guidelines:\n" +
  "- Only the CUSTOMER's messages indicate intent; Haiwan's own replies are context.\n" +
  "- Prefer specific, deduplicated leads. Merge a single order spanning several messages into one lead.\n" +
  "- Map products to the catalog below when you can, but still record the lead if a product isn't listed.\n" +
  "- Set confidence honestly: a firm 'I want to buy 2 bags of X' is high; a vague 'might need food soon' is low.\n" +
  "- If there is nothing actionable, return an empty leads list.";

function getConfig() {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const model = process.env.WHATSAPP_ANALYSIS_MODEL?.trim() || DEFAULT_MODEL;
  const baseUrl = process.env.ANTHROPIC_BASE_URL?.trim() || "https://api.anthropic.com";
  return { apiKey, model, baseUrl };
}

/** Build the cached system blocks: static instructions + product catalog. */
function buildSystemBlocks(products: Array<{ name: string; brand: string | null; category: string }>) {
  const catalog =
    products.length > 0
      ? "Product catalog (name — brand — category):\n" +
        products
          .slice(0, 600)
          .map((p) => `- ${p.name}${p.brand ? ` — ${p.brand}` : ""} — ${p.category}`)
          .join("\n")
      : "Product catalog is empty.";

  return [
    { type: "text", text: SYSTEM_INSTRUCTIONS },
    // Mark the catalog block as cacheable — it's identical across every
    // per-customer call in this run.
    { type: "text", text: catalog, cache_control: { type: "ephemeral" } },
  ];
}

async function callClaude(
  cfg: { apiKey: string; model: string; baseUrl: string },
  systemBlocks: unknown[],
  transcript: string,
): Promise<ModelLead[]> {
  const res = await fetch(`${cfg.baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": API_VERSION,
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 1024,
      system: systemBlocks,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "record_leads" },
      messages: [
        {
          role: "user",
          content: `Conversation transcript (newest last):\n\n${transcript}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; name?: string; input?: { leads?: ModelLead[] } }>;
  };
  const toolUse = data.content?.find((b) => b.type === "tool_use" && b.name === "record_leads");
  return toolUse?.input?.leads ?? [];
}

function coerceType(t: string): LeadType {
  const up = t.toUpperCase().trim() as LeadType;
  return LEAD_TYPES.includes(up) ? up : "OTHER";
}

function clampConfidence(c: number | undefined): number {
  if (typeof c !== "number" || !Number.isFinite(c)) return 0.5;
  return Math.max(0, Math.min(1, c));
}

/**
 * Run the analysis.
 * @param opts.date  Restrict to messages whose timestamp falls on this local day.
 *                   Omit to analyse the entire unanalysed backlog.
 */
export async function runEodAnalysis(opts: { date?: Date } = {}): Promise<AnalysisSummary> {
  const { apiKey, model, baseUrl } = getConfig();
  if (!apiKey) {
    return {
      ok: false,
      reason:
        "ANTHROPIC_API_KEY is not set. Add it to the app's .env (and restart) to enable analysis.",
      customersAnalyzed: 0,
      messagesAnalyzed: 0,
      leadsCreated: 0,
      errors: [],
    };
  }

  // ---- Select unanalysed messages (both directions, for context) ----
  const where: { analyzedAt: null; timestamp?: { gte: Date; lt: Date } } = { analyzedAt: null };
  if (opts.date) {
    const start = new Date(opts.date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    where.timestamp = { gte: start, lt: end };
  }

  const messages = await prisma.whatsAppMessage.findMany({
    where,
    orderBy: { timestamp: "asc" },
  });

  const summary: AnalysisSummary = {
    ok: true,
    customersAnalyzed: 0,
    messagesAnalyzed: 0,
    leadsCreated: 0,
    errors: [],
  };

  if (messages.length === 0) return summary;

  // ---- Group by customer (fall back to phone for unlinked) ----
  type Group = {
    key: string;
    customerId: string | null;
    phone: string;
    contactName: string | null;
    messageIds: string[];
    hasInbound: boolean;
    transcript: string[];
    latest: Date;
  };
  const groups = new Map<string, Group>();
  for (const m of messages) {
    const key = m.customerId ?? `phone:${m.phone}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        customerId: m.customerId,
        phone: m.phone,
        contactName: m.contactName,
        messageIds: [],
        hasInbound: false,
        transcript: [],
        latest: m.timestamp,
      };
      groups.set(key, g);
    }
    g.messageIds.push(m.id);
    if (m.direction === "INBOUND") g.hasInbound = true;
    if (!g.contactName && m.contactName) g.contactName = m.contactName;
    if (m.timestamp > g.latest) g.latest = m.timestamp;
    const who = m.direction === "INBOUND" ? "Customer" : "Haiwan";
    g.transcript.push(`[${m.timestamp.toISOString().slice(0, 16).replace("T", " ")}] ${who}: ${m.body}`);
  }

  // ---- Product index for mapping proposed items to SKUs ----
  const products = await prisma.product.findMany({
    select: { id: true, sku: true, name: true, brand: true, category: true },
  });
  const productIndex = buildProductIndex(products.map((p) => ({ id: p.id, name: p.name, sku: p.sku })));
  const systemBlocks = buildSystemBlocks(products);

  // ---- Analyse each group that has at least one inbound message ----
  for (const g of groups.values()) {
    if (!g.hasInbound) continue; // outbound-only window: nothing to extract
    try {
      const leads = await callClaude({ apiKey, model, baseUrl }, systemBlocks, g.transcript.join("\n"));
      summary.customersAnalyzed++;

      for (const lead of leads) {
        const items = (lead.items ?? []).map((it) => {
          const productName = (it.productName ?? "").trim();
          const matchedProductId = productName ? matchProduct(productName, productIndex) : null;
          const matchedSku = matchedProductId
            ? products.find((p) => p.id === matchedProductId)?.sku ?? null
            : null;
          return { productName, quantity: it.quantity ?? null, matchedProductId, matchedSku };
        });

        await prisma.whatsAppLead.create({
          data: {
            customerId: g.customerId,
            phone: g.phone,
            contactName: g.contactName,
            type: coerceType(lead.type),
            summary: (lead.summary ?? "").slice(0, 500) || "(no summary)",
            itemsJson: items.length > 0 ? JSON.stringify(items) : null,
            evidence: lead.evidence?.slice(0, 1000) ?? null,
            confidence: clampConfidence(lead.confidence),
            analysisDate: opts.date ?? g.latest,
          },
        });
        summary.leadsCreated++;
      }
    } catch (e) {
      summary.errors.push(`${g.contactName ?? g.phone}: ${(e as Error).message}`);
      // Leave this group's messages unanalysed so a re-run retries them.
      continue;
    }
  }

  // ---- Mark analysed: every message in groups we successfully processed ----
  const analysedIds: string[] = [];
  for (const g of groups.values()) {
    // Outbound-only groups have nothing to extract but shouldn't be retried.
    // Inbound groups are marked only if they didn't error (still in messageIds).
    const erroredGroup = summary.errors.some((e) => e.startsWith(`${g.contactName ?? g.phone}:`));
    if (g.hasInbound && erroredGroup) continue;
    analysedIds.push(...g.messageIds);
  }
  if (analysedIds.length > 0) {
    await prisma.whatsAppMessage.updateMany({
      where: { id: { in: analysedIds } },
      data: { analyzedAt: new Date() },
    });
    summary.messagesAnalyzed = analysedIds.length;
  }

  return summary;
}
