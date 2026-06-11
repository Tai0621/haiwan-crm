// =============================================================================
// Scheduled StoreHub sync — invoked by Vercel Cron (see vercel.json).
// The deployed equivalent of the "Sync transactions" + "Sync members" buttons:
// pulls recent sales and refreshes the member list into the CRM.
//
// Protected by CRON_SECRET (Vercel sends "Authorization: Bearer <secret>"
// automatically). Open if CRON_SECRET is unset (e.g. local dev).
// =============================================================================
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { syncStoreHubTransactions, syncStoreHubCustomers } from "@/lib/storehub";

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

  // Pull a generous 3-day window so a missed run still catches up; dedupe makes
  // the overlap free. Refresh members too.
  const [transactions, customers] = await Promise.all([
    syncStoreHubTransactions(3),
    syncStoreHubCustomers(),
  ]);

  return NextResponse.json({ ranAt: new Date().toISOString(), transactions, customers });
}
