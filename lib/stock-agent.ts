// =============================================================================
// Stock agent — parses a free-text restock / transfer / stock-take message
// (from WhatsApp or the paste box on /inventory) into structured items matched
// against the product catalog, and stores the result as a PENDING StockUpdate
// for human review. Apply happens in lib/inventory.ts.
//
// Same Anthropic Messages API pattern as the WhatsApp EOD analysis: direct
// fetch, cached catalog system block, forced tool call for structured output.
// Config (env): ANTHROPIC_API_KEY (required), WHATSAPP_ANALYSIS_MODEL
// (default claude-haiku-4-5), ANTHROPIC_BASE_URL.
// =============================================================================

import { prisma } from "./db";
import { buildProductIndex, matchProduct } from "./match";
import type { StockUpdateItem } from "./inventory";

const API_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-haiku-4-5";

export interface ParseResult {
  ok: boolean;
  updateId?: string;
  summary?: string;
  itemCount?: number;
  unmatched?: number;
  error?: string;
}

function getConfig() {
  return {
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    model: process.env.WHATSAPP_ANALYSIS_MODEL || DEFAULT_MODEL,
    baseUrl: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com",
  };
}

const TOOL = {
  name: "record_stock_update",
  description:
    "Record the stock operations described in the message. Use one item per product per operation.",
  input_schema: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "One short line describing the whole message, e.g. 'Restock at PJ — 4 products'.",
      },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["restock", "transfer", "set"],
              description:
                "restock = goods arriving into a store. transfer = moving stock between the two stores. " +
                "set = a stock take stating the absolute count now on hand.",
            },
            productName: {
              type: "string",
              description:
                "The product, using the EXACT name from the catalog when a clear match exists; otherwise as written.",
            },
            qty: { type: "number", description: "Units (for 'set': the absolute count)." },
            store: {
              type: "string",
              enum: ["KL", "PJ"],
              description: "For restock/set: which store. Omit if the message doesn't say.",
            },
            fromStore: { type: "string", enum: ["KL", "PJ"], description: "For transfer: origin." },
            toStore: { type: "string", enum: ["KL", "PJ"], description: "For transfer: destination." },
          },
          required: ["action", "productName", "qty"],
        },
      },
    },
    required: ["summary", "items"],
  },
} as const;

const SYSTEM_INSTRUCTIONS =
  "You parse internal stock messages for Haiwan, a Malaysian pet supplies retailer with exactly two " +
  "stores: KL and PJ. Staff send lists like 'Restock PJ: Ziwi lamb x12, RC kitten 2kg x6', " +
  "'Transfer 5 tofu litter KL to PJ', or stock takes like 'Stock count KL: Kong classic = 4'. " +
  "Messages may mix English and Malay and use loose product names.\n\n" +
  "Rules:\n" +
  "- A store stated once as a heading applies to every item under it.\n" +
  "- Do NOT guess a store that isn't stated or implied — omit it instead.\n" +
  "- Map each product to the catalog below and return the catalog's exact name when the match is clear; " +
  "if nothing plausibly matches, keep the name as written.\n" +
  "- Quantities like 'x12', '12pcs', '12 bags' all mean 12. A transfer's qty is the amount moved.\n" +
  "- Record every distinct product line; never merge different products.";

interface ModelItem {
  action?: string;
  productName?: string;
  qty?: number | string;
  store?: string;
  fromStore?: string;
  toStore?: string;
}

async function callClaude(rawText: string): Promise<{ summary: string; items: ModelItem[] }> {
  const cfg = getConfig();
  const products = await prisma.product.findMany({
    select: { name: true, sku: true },
    orderBy: { name: "asc" },
  });
  const catalog =
    "Product catalog (name — sku):\n" + products.map((p) => `- ${p.name} — ${p.sku}`).join("\n");

  const res = await fetch(`${cfg.baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": API_VERSION,
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 2048,
      system: [
        { type: "text", text: SYSTEM_INSTRUCTIONS },
        { type: "text", text: catalog, cache_control: { type: "ephemeral" } },
      ],
      tools: [TOOL],
      tool_choice: { type: "tool", name: "record_stock_update" },
      messages: [{ role: "user", content: `Stock message:\n\n${rawText}` }],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    content?: Array<{ type: string; name?: string; input?: { summary?: string; items?: ModelItem[] } }>;
  };
  const toolUse = data.content?.find((b) => b.type === "tool_use" && b.name === "record_stock_update");
  return { summary: toolUse?.input?.summary ?? "Stock update", items: toolUse?.input?.items ?? [] };
}

const asStore = (s: string | undefined): "KL" | "PJ" | null =>
  s === "KL" || s === "PJ" ? s : null;

/**
 * Parse a stock message into a PENDING StockUpdate. Never throws — failures are
 * reported in the result (and the caller decides how to surface them).
 */
export async function parseStockMessage(
  rawText: string,
  source: "WHATSAPP" | "PASTE",
  phone?: string | null,
): Promise<ParseResult> {
  const text = rawText.trim();
  if (!text) return { ok: false, error: "Empty message." };
  if (!getConfig().apiKey) {
    return {
      ok: false,
      error: "AI parsing needs ANTHROPIC_API_KEY. Use the quick restock/transfer forms instead.",
    };
  }

  try {
    const { summary, items: modelItems } = await callClaude(text);

    // Match names to the catalog locally (the model returns names, not ids).
    const crmProducts = await prisma.product.findMany({ select: { id: true, name: true, sku: true } });
    const index = buildProductIndex(crmProducts);

    const items: StockUpdateItem[] = modelItems.map((m) => {
      const name = (m.productName ?? "").trim();
      const qty = typeof m.qty === "string" ? parseFloat(m.qty) : m.qty ?? NaN;
      const action = (m.action === "transfer" || m.action === "set" ? m.action : "restock") as StockUpdateItem["action"];
      return {
        action,
        productName: name || "?",
        productId: name ? matchProduct(name, index) : null,
        qty: Number.isFinite(qty) ? Math.round(qty as number) : NaN,
        store: asStore(m.store),
        fromStore: asStore(m.fromStore),
        toStore: asStore(m.toStore),
      };
    });

    const update = await prisma.stockUpdate.create({
      data: {
        source,
        phone: phone ?? null,
        rawText: text,
        summary,
        itemsJson: JSON.stringify(items),
      },
    });

    return {
      ok: true,
      updateId: update.id,
      summary,
      itemCount: items.length,
      unmatched: items.filter((i) => !i.productId).length,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** True when an inbound WhatsApp message looks like a stock instruction. */
export function looksLikeStockMessage(body: string): boolean {
  return /^(restock|transfer|stock)\b/i.test(body.trim());
}
