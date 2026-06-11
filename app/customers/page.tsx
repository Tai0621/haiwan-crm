import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatPhoneDisplay } from "@/lib/phone";
import { STORE_LABELS, SOURCE_LABELS } from "@/lib/constants";
import Pagination from "@/app/components/Pagination";
import SyncMembersButton from "./SyncMembersButton";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type SearchParams = Promise<{
  q?: string;
  store?: string;
  needs?: string;
  page?: string;
}>;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q, store, needs, page: pageParam } = await searchParams;

  // Build the filter
  const where: Record<string, unknown> = {};
  if (q && q.trim()) {
    const term = q.trim();
    const digits = term.replace(/\D/g, "");
    const or: Array<Record<string, unknown>> = [
      { name: { contains: term } },
      { email: { contains: term } },
    ];
    // Only match on phone when the term actually has digits — otherwise
    // `phone contains ""` matches every customer and the name search returns all.
    if (digits) or.push({ phone: { contains: digits } });
    where.OR = or;
  }
  if (store && store !== "ALL") where.preferredStore = store;
  if (needs === "1") where.needsDetails = true;

  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const [totalCount, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: [{ needsDetails: "desc" }, { updatedAt: "desc" }],
      include: {
        pets: { select: { id: true, name: true, species: true } },
        _count: { select: { transactions: true } },
      },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500">
            {totalCount.toLocaleString()} {totalCount === 1 ? "result" : "results"}
          </p>
        </div>
        <div className="flex items-start gap-2">
          <SyncMembersButton />
          <Link
            href="/customers/new"
            className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-700"
          >
            + New customer
          </Link>
        </div>
      </div>

      {/* Filter bar */}
      <form className="bg-white border border-slate-200 rounded-lg p-3 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Search (name, phone, email)
          </label>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="e.g. Aishah or 012…"
            className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Store</label>
          <select
            name="store"
            defaultValue={store ?? "ALL"}
            className="border border-slate-300 rounded-md px-3 py-1.5 text-sm"
          >
            <option value="ALL">All</option>
            <option value="KL">Kuala Lumpur</option>
            <option value="PJ">Petaling Jaya</option>
            <option value="NONE">No preference</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 pb-1.5">
          <input type="checkbox" name="needs" value="1" defaultChecked={needs === "1"} />
          Needs details only
        </label>
        <button className="bg-slate-200 text-slate-800 px-4 py-1.5 rounded-md text-sm font-medium hover:bg-slate-300">
          Apply
        </button>
        <Link href="/customers" className="text-sm text-slate-500 hover:underline pb-1.5">
          Reset
        </Link>
      </form>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Phone</th>
              <th className="px-4 py-2 font-medium">Pets</th>
              <th className="px-4 py-2 font-medium">Store</th>
              <th className="px-4 py-2 font-medium">Source</th>
              <th className="px-4 py-2 font-medium text-right">Txns</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {customers.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link href={`/customers/${c.id}`} className="font-medium text-slate-900 hover:underline">
                    {c.name ?? <span className="text-slate-400 italic">Unnamed</span>}
                  </Link>
                  {c.needsDetails && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                      needs details
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-slate-600 font-mono text-xs">
                  {formatPhoneDisplay(c.phone)}
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {c.pets.length === 0 ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {c.pets.map((p) => (
                        <span
                          key={p.id}
                          className="inline-block text-xs bg-slate-100 text-slate-600 rounded px-1.5 py-0.5"
                        >
                          {p.name}
                        </span>
                      ))}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-slate-600">{STORE_LABELS[c.preferredStore]}</td>
                <td className="px-4 py-2 text-slate-600">{SOURCE_LABELS[c.source]}</td>
                <td className="px-4 py-2 text-right text-slate-600">{c._count.transactions}</td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No customers match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination
          basePath="/customers"
          params={{ q, store, needs }}
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
        />
      </div>
    </div>
  );
}
