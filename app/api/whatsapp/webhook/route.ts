// =============================================================================
// WhatsApp Cloud API webhook — Meta WhatsApp Business Platform.
//
//   GET  /api/whatsapp/webhook   verification handshake (Meta calls this once,
//                                when you save the webhook in the Meta app).
//   POST /api/whatsapp/webhook   delivery of inbound customer messages, which
//                                we parse and persist via ingestMessages().
//
// Env vars (set in Vercel once you create the Meta app + register the number):
//   WHATSAPP_VERIFY_TOKEN  Any string you choose. Paste the SAME value into
//                          Meta's webhook config — GET only succeeds if they
//                          match. Required.
//   WHATSAPP_APP_SECRET    Your Meta "App Secret". When set, every POST body is
//                          verified against the X-Hub-Signature-256 HMAC so only
//                          Meta can post here. Strongly recommended.
//
// Note: only INBOUND customer messages arrive via the webhook (the business's
// own replies are not delivered). Analysis runs separately — the EOD cron /
// "Run analysis" button — and needs ANTHROPIC_API_KEY to be set.
// =============================================================================
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import crypto from "node:crypto";
import { parseCloudApiWebhook } from "@/lib/whatsapp/cloud-api";
import { ingestMessages } from "@/lib/whatsapp/ingest";
import { parseStockMessage, looksLikeStockMessage } from "@/lib/stock-agent";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // needs node:crypto + Prisma/libsql (not Edge)

// --- GET: webhook verification handshake -----------------------------------
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge") ?? "";
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && expected && token === expected) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

// --- POST: inbound message delivery ----------------------------------------
export async function POST(request: NextRequest) {
  const raw = await request.text();

  // Verify the payload really came from Meta (when the secret is configured).
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (appSecret) {
    const signature = request.headers.get("x-hub-signature-256") ?? "";
    const expected =
      "sha256=" + crypto.createHmac("sha256", appSecret).update(raw).digest("hex");
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return new NextResponse("invalid signature", { status: 401 });
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    // Malformed body — ack anyway so Meta doesn't retry-storm.
    return NextResponse.json({ ok: true });
  }

  try {
    const messages = parseCloudApiWebhook(payload);
    if (messages.length) await ingestMessages(messages, "CLOUD_API");

    // Stock agent: staff messages starting with RESTOCK / TRANSFER / STOCK are
    // inventory instructions — parse each into a pending update on /inventory.
    for (const m of messages) {
      if (m.direction === "INBOUND" && looksLikeStockMessage(m.body)) {
        const r = await parseStockMessage(m.body, "WHATSAPP", m.phone);
        if (!r.ok) console.error("Stock agent parse failed:", r.error);
      }
    }
  } catch (e) {
    // Log but still ack: Meta retries aggressively on any non-2xx response.
    console.error("WhatsApp Cloud API webhook error:", e);
  }

  return NextResponse.json({ ok: true });
}
