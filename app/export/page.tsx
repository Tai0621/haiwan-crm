import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const TABLES: Array<{ slug: string; label: string; desc: string }> = [
  { slug: "customers", label: "Customers", desc: "Contacts/payers, phone as identity key, PDPA consent" },
  { slug: "pets", label: "Pets", desc: "The central entity — linked to a customer" },
  { slug: "products", label: "Products", desc: "Catalog incl. supplierType & isConsumable" },
  { slug: "transactions", label: "Transactions", desc: "Sales events (receipts)" },
  { slug: "lines", label: "Transaction lines", desc: "Line items, linked to product & pet" },
  { slug: "subscriptions", label: "Subscriptions", desc: "Recurring order intents" },
];

export default async function ExportPage() {
  const [customers, pets, products, transactions, lines, subscriptions] = await Promise.all([
    prisma.customer.count(),
    prisma.pet.count(),
    prisma.product.count(),
    prisma.transaction.count(),
    prisma.transactionLine.count(),
    prisma.subscription.count(),
  ]);
  const counts: Record<string, number> = {
    customers,
    pets,
    products,
    transactions,
    lines,
    subscriptions,
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 mb-1">Export</h1>
      <p className="text-sm text-slate-500 mb-4">
        Download any table as CSV. Exports include raw ids and foreign keys so the data can be
        faithfully reconstructed in the future system.
      </p>

      <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
        {TABLES.map((t) => (
          <div key={t.slug} className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="font-medium text-slate-900">
                {t.label}{" "}
                <span className="text-xs text-slate-400 font-normal">({counts[t.slug]} rows)</span>
              </div>
              <div className="text-xs text-slate-500">{t.desc}</div>
            </div>
            <a
              href={`/export/${t.slug}`}
              className="bg-slate-900 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-slate-700"
              download
            >
              Download CSV
            </a>
          </div>
        ))}
      </div>

      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <p className="font-medium mb-1">Migration handoff</p>
        <p>
          This app is temporary — the accumulated data is the real deliverable. The two artifacts
          the future team needs are the SQLite database file{" "}
          <code className="font-mono bg-amber-100 px-1 rounded">data/haiwan.db</code> and the
          commented schema{" "}
          <code className="font-mono bg-amber-100 px-1 rounded">prisma/schema.prisma</code>. These
          CSV exports are a convenient, tool-agnostic snapshot of the same data.
        </p>
      </div>
    </div>
  );
}
