import { prisma } from "@/lib/db";
import { buildXlsx, type Cell } from "@/lib/xlsx";
import { STORE_LABELS } from "@/lib/constants";

// =============================================================================
// Excel (.xlsx) export of transactions — one row per transaction, with a
// Products column summarising the line items. Mirrors the Transactions page.
// =============================================================================

export const dynamic = "force-dynamic";

function fmtMYT(d: Date): string {
  // "YYYY-MM-DD HH:mm" in Asia/Kuala_Lumpur, Excel-friendly (sortable text).
  const s = d.toLocaleString("sv-SE", { timeZone: "Asia/Kuala_Lumpur" }); // sv-SE => ISO-ish
  return s.slice(0, 16);
}

export async function GET() {
  const txns = await prisma.transaction.findMany({
    orderBy: { transactionDate: "desc" },
    include: {
      customer: { select: { name: true, phone: true } },
      lines: {
        select: { quantity: true, rawProductName: true, product: { select: { name: true } } },
      },
    },
  });

  const headers = [
    "Date (MYT)", "Store", "Customer", "Phone", "Products", "Items", "Total (RM)", "Source", "Receipt",
  ];

  const rows: Cell[][] = txns.map((t) => {
    const products = t.lines
      .map((l) => {
        const name = l.product?.name ?? l.rawProductName;
        const q = Math.round(l.quantity);
        return q > 1 ? `${name} ×${q}` : name;
      })
      .join("; ");
    return [
      fmtMYT(t.transactionDate),
      STORE_LABELS[t.store] ?? t.store,
      t.customer?.name ?? "",
      t.customer?.phone ?? "",
      products,
      t.lines.length,
      Number(t.totalAmount.toFixed(2)),
      t.storehubRef ? "import" : "manual",
      t.storehubRef ?? "",
    ];
  });

  const xlsx = buildXlsx("Transactions", headers, rows);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(xlsx), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="haiwan-transactions-${date}.xlsx"`,
    },
  });
}
