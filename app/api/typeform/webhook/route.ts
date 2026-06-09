// =============================================================================
// Typeform webhook — receives a form submission and creates/links the customer
// and their pet in the CRM.
//
//   POST /api/typeform/webhook
//
// Set the webhook in Typeform: Connect → Webhooks → add this URL, and set a
// secret. Then add that same secret here as TYPEFORM_WEBHOOK_SECRET so we can
// verify the Typeform-Signature (HMAC-SHA256, base64). If the secret is unset,
// verification is skipped (dev only).
// =============================================================================
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import crypto from "node:crypto";
import { parseTypeformResponse, ingestTypeformSubmission } from "@/lib/typeform";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // needs node:crypto + Prisma/libsql

export async function POST(request: NextRequest) {
  const raw = await request.text();

  const secret = process.env.TYPEFORM_WEBHOOK_SECRET;
  if (secret) {
    const signature = request.headers.get("typeform-signature") ?? "";
    const expected =
      "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("base64");
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
    return NextResponse.json({ ok: true });
  }

  try {
    const parsed = parseTypeformResponse(payload);
    if (parsed) {
      const result = await ingestTypeformSubmission(parsed);
      return NextResponse.json({ ok: true, ...result });
    }
  } catch (e) {
    // Log but still 200 so Typeform doesn't retry-storm; we'll see it in logs.
    console.error("Typeform webhook error:", e);
  }

  return NextResponse.json({ ok: true });
}
