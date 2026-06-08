import { prisma } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import SyncButton from "./SyncButton";

export const dynamic = "force-dynamic";

export default async function WixPage() {
  const configured = !!(process.env.WIX_API_KEY && process.env.WIX_SITE_ID);

  const [syncedCount, lastSynced, recent] = await Promise.all([
    prisma.product.count({ where: { wixStock: { not: null } } }),
    prisma.product.findFirst({
      where: { wixSyncedAt: { not: null } },
      orderBy: { wixSyncedAt: "desc" },
      select: { wixSyncedAt: true },
    }),
    prisma.product.findMany({
      where: { wixStock: { not: null } },
      orderBy: { wixSyncedAt: "desc" },
      take: 50,
      select: { id: true, name: true, wixStock: true, stockKL: true, stockPJ: true, wixSyncedAt: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Wix inventory</h1>
        <p className="text-sm text-slate-500 mt-1">
          Wix is the source of truth for on-hand stock. Syncing pulls each Wix product&rsquo;s
          quantity and writes it onto the matching CRM product (matched by name).
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        {!configured && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <strong>Not configured.</strong> Set <code>WIX_API_KEY</code> and{" "}
            <code>WIX_SITE_ID</code> in the environment to enable syncing.
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-slate-400">Connection</dt>
            <dd className="text-slate-800">{configured ? "Configured" : "Not configured"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Products with Wix stock</dt>
            <dd className="text-slate-800">{syncedCount}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Last synced</dt>
            <dd className="text-slate-800">
              {lastSynced?.wixSyncedAt ? fmtDateTime(lastSynced.wixSyncedAt) : "Never"}
            </dd>
          </div>
        </div>

        <SyncButton disabled={!configured} />
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-3">Recently synced ({recent.length})</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-slate-400">No products synced yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-slate-400 text-left text-xs border-b border-slate-100">
              <tr>
                <th className="py-2 font-medium">Product</th>
                <th className="py-2 font-medium text-right">Wix stock</th>
                <th className="py-2 font-medium text-right">Legacy KL/PJ</th>
                <th className="py-2 font-medium text-right">Synced</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recent.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 text-slate-700">{p.name}</td>
                  <td className="py-2 text-right font-medium text-slate-900 tabular-nums">
                    {p.wixStock ?? "—"}
                  </td>
                  <td className="py-2 text-right text-slate-400 tabular-nums">
                    {p.stockKL} / {p.stockPJ}
                  </td>
                  <td className="py-2 text-right text-slate-500 whitespace-nowrap">
                    {fmtDateTime(p.wixSyncedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
