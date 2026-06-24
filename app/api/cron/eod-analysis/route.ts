// =============================================================================
// Automated end-of-day WhatsApp analysis — invoked by Vercel Cron (see
// vercel.json). This is the deployed equivalent of the "Run end-of-day
// analysis" button: it scans unanalysed messages and creates lead suggestions.
//
// Protected by CRON_SECRET. Vercel Cron sends "Authorization: Bearer <secret>"
// automatically when CRON_SECRET is set in the project env, so external callers
// can't trigger it. If CRON_SECRET is unset (e.g. local dev), it runs open.
// =============================================================================
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { runEodAnalysis } from "@/lib/whatsapp/analyze";
import { sweepExpiredHolds } from "@/lib/tasks";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // seconds — generous headroom for the LLM calls

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  // Backstop for the Action Inbox: flip any lapsed 24h holds to EXPIRED and spawn
  // their courtesy follow-ups, so loops close even on a day no one opens the app.
  const holdsSwept = await sweepExpiredHolds();

  const result = await runEodAnalysis();
  return NextResponse.json({ ranAt: new Date().toISOString(), holdsSwept, ...result });
}
