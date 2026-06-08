// =============================================================================
// Scheduled Wix inventory sync — invoked by Vercel Cron (see vercel.json).
// The deployed equivalent of the "Sync inventory from Wix" button: pulls Wix
// stock and writes it onto matching CRM products.
//
// Protected by CRON_SECRET (Vercel sends "Authorization: Bearer <secret>"
// automatically). Open if CRON_SECRET is unset (e.g. local dev).
// =============================================================================
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { syncWixInventory } from "@/lib/wix";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const result = await syncWixInventory();
  return NextResponse.json({ ranAt: new Date().toISOString(), ...result });
}
