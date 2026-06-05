"use server";

import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { buildProductIndex, matchProduct } from "@/lib/match";
import { revalidatePath } from "next/cache";

type Row = Record<string, string>;

// ---------------------------------------------------------------------------
// PRODUCT CATALOG IMPORT
// Mapping maps each Product field -> a CSV column header (or "" to skip).
// Upserts by SKU.
// ---------------------------------------------------------------------------

export interface ProductMapping {
  sku: string;
  name: string;
  brand: string;
  category: string;
  packSize: string;
  packUnit: string;
  supplierType: string;
  costPrice: string;
  retailPrice: string;
  isConsumable: string;
  targetSpecies: string;
  lifeStage: string;
  stockKL: string;
  stockPJ: string;
}

export interface ProductImportSummary {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

function cell(row: Row, col: string): string {
  if (!col) return "";
  return (row[col] ?? "").trim();
}

function parseFloatOrNull(s: string): number | null {
  if (!s) return null;
  const n = parseFloat(s.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

// Stock counts are exported as decimals like "7.00" — parse as float and round.
function parseQty(s: string): number {
  const n = parseFloat((s || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function parseBool(s: string): boolean {
  const v = s.toLowerCase().trim();
  return ["1", "true", "yes", "y", "consumable"].includes(v);
}

// When an "is consumable" column isn't provided (e.g. StoreHub exports), infer
// it from the category/name so refill prediction works for food & treats.
const CONSUMABLE_CATEGORIES = new Set(["FOOD", "TREATS", "TREAT", "LITTER BOX", "LITTER"]);
const CONSUMABLE_KEYWORDS = ["kibble", "topper", "treat", "jerky", "food", "snack", "litter", "dental", "freeze-dried", "broth", "supplement"];
function deriveConsumable(category: string, name: string): boolean {
  if (CONSUMABLE_CATEGORIES.has(category.toUpperCase().trim())) return true;
  const n = name.toLowerCase();
  return CONSUMABLE_KEYWORDS.some((k) => n.includes(k));
}

function normEnum<T extends string>(s: string, allowed: T[], fallback: T): T {
  const v = s.toUpperCase().trim().replace(/[\s-]+/g, "_") as T;
  return allowed.includes(v) ? v : fallback;
}

export async function importProducts(
  rows: Row[],
  mapping: ProductMapping,
): Promise<ProductImportSummary> {
  const summary: ProductImportSummary = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const sku = cell(row, mapping.sku);
    const name = cell(row, mapping.name);

    if (!sku || !name) {
      summary.skipped++;
      summary.errors.push(`Row ${i + 1}: missing SKU or name — skipped.`);
      continue;
    }

    const packUnit = normEnum(
      cell(row, mapping.packUnit),
      ["G", "KG", "ML", "L", "COUNT"],
      "" as never,
    );

    const data = {
      name,
      brand: cell(row, mapping.brand) || null,
      category: cell(row, mapping.category) || "other",
      targetSpecies: normEnum(cell(row, mapping.targetSpecies), ["DOG", "CAT", "ANY"], "ANY"),
      lifeStage: normEnum(
        cell(row, mapping.lifeStage),
        ["PUPPY_KITTEN", "ADULT", "SENIOR", "ANY"],
        "ANY",
      ),
      packSize: parseFloatOrNull(cell(row, mapping.packSize)),
      packUnit: packUnit ? (packUnit as "G" | "KG" | "ML" | "L" | "COUNT") : null,
      supplierType: normEnum(
        cell(row, mapping.supplierType),
        ["TRADING", "CONSIGNMENT", "INHOUSE"],
        "TRADING",
      ),
      costPrice: parseFloatOrNull(cell(row, mapping.costPrice)),
      retailPrice: parseFloatOrNull(cell(row, mapping.retailPrice)),
      isConsumable: mapping.isConsumable
        ? parseBool(cell(row, mapping.isConsumable))
        : deriveConsumable(cell(row, mapping.category), name),
      stockKL: parseQty(cell(row, mapping.stockKL)),
      stockPJ: parseQty(cell(row, mapping.stockPJ)),
    };

    try {
      const existing = await prisma.product.findUnique({ where: { sku } });
      await prisma.product.upsert({
        where: { sku },
        update: data,
        create: { sku, ...data },
      });
      if (existing) summary.updated++;
      else summary.created++;
    } catch (e) {
      summary.skipped++;
      summary.errors.push(`Row ${i + 1} (${sku}): ${(e as Error).message}`);
    }
  }

  revalidatePath("/products");
  return summary;
}

// ---------------------------------------------------------------------------
// STOREHUB TRANSACTION IMPORT
// ---------------------------------------------------------------------------

export interface TxnMapping {
  phone: string;
  transactionDate: string;
  store: string;
  storehubRef: string;
  productName: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  transactionTotal: string;
}

export interface TxnImportSummary {
  transactionsCreated: number;
  transactionsSkippedDuplicate: number;
  customersMatched: number;
  stubsCreated: number;
  unmatchedPhoneRows: number;
  linesMatched: number;
  linesUnmatched: number;
  errors: string[];
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  // Try native parse first
  let d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  // Try DD/MM/YYYY or DD-MM-YYYY (common in MY exports)
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) {
    const [, dd, mm, yyyyRaw, hh, min] = m;
    const yyyy = yyyyRaw.length === 2 ? "20" + yyyyRaw : yyyyRaw;
    d = new Date(
      parseInt(yyyy),
      parseInt(mm) - 1,
      parseInt(dd),
      hh ? parseInt(hh) : 0,
      min ? parseInt(min) : 0,
    );
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

export async function importTransactions(
  rows: Row[],
  mapping: TxnMapping,
  groupBy: "ref" | "phone-date",
): Promise<TxnImportSummary> {
  const summary: TxnImportSummary = {
    transactionsCreated: 0,
    transactionsSkippedDuplicate: 0,
    customersMatched: 0,
    stubsCreated: 0,
    unmatchedPhoneRows: 0,
    linesMatched: 0,
    linesUnmatched: 0,
    errors: [],
  };

  // Build product match index once.
  const products = await prisma.product.findMany({ select: { id: true, name: true, sku: true } });
  const productIndex = buildProductIndex(products);

  // ---- Group rows into transactions ----
  type Line = {
    rawProductName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  };
  type Group = {
    rawPhone: string;
    phone: string | null;
    date: Date | null;
    store: "KL" | "PJ";
    ref: string | null;
    transactionTotal: number | null;
    lines: Line[];
  };

  const groups = new Map<string, Group>();

  for (const row of rows) {
    const rawPhone = cell(row, mapping.phone);
    const phone = normalizePhone(rawPhone);
    const ref = cell(row, mapping.storehubRef) || null;
    const date = parseDate(cell(row, mapping.transactionDate));
    const storeRaw = cell(row, mapping.store).toUpperCase();
    const store: "KL" | "PJ" = storeRaw.includes("PJ") || storeRaw.includes("PETALING") ? "PJ" : "KL";

    // Grouping key
    let key: string;
    if (groupBy === "ref" && ref) {
      key = `ref:${ref}`;
    } else {
      // by phone + date (day-level) as fallback
      const dayKey = date ? date.toISOString().slice(0, 10) : "nodate";
      key = `pd:${phone ?? rawPhone}:${dayKey}`;
    }

    if (!groups.has(key)) {
      groups.set(key, {
        rawPhone,
        phone,
        date,
        store,
        ref,
        transactionTotal: parseFloatOrNull(cell(row, mapping.transactionTotal)),
        lines: [],
      });
    }
    const g = groups.get(key)!;

    // Add the line (only if there's a product name)
    const rawProductName = cell(row, mapping.productName);
    if (rawProductName) {
      const quantity = parseFloatOrNull(cell(row, mapping.quantity)) ?? 1;
      const unitPrice = parseFloatOrNull(cell(row, mapping.unitPrice)) ?? 0;
      const lineTotal =
        parseFloatOrNull(cell(row, mapping.lineTotal)) ?? quantity * unitPrice;
      g.lines.push({ rawProductName, quantity, unitPrice, lineTotal });
    }
  }

  // Cache of phone -> customerId to count matched vs created correctly per run
  const seenCustomers = new Set<string>();

  for (const g of groups.values()) {
    try {
      // ---- Resolve customer ----
      let customerId: string | null = null;
      if (g.phone) {
        const existing = await prisma.customer.findUnique({ where: { phone: g.phone } });
        if (existing) {
          customerId = existing.id;
          if (!seenCustomers.has(existing.id)) {
            seenCustomers.add(existing.id);
            summary.customersMatched++;
          }
        } else {
          const stub = await prisma.customer.create({
            data: { phone: g.phone, source: "STOREHUB", needsDetails: true },
          });
          customerId = stub.id;
          seenCustomers.add(stub.id);
          summary.stubsCreated++;
        }
      } else {
        summary.unmatchedPhoneRows++;
      }

      // ---- Idempotency: skip if storehubRef already imported ----
      if (g.ref) {
        const dup = await prisma.transaction.findFirst({ where: { storehubRef: g.ref } });
        if (dup) {
          summary.transactionsSkippedDuplicate++;
          continue;
        }
      }

      // ---- Compute total ----
      const linesTotal = g.lines.reduce((s, l) => s + l.lineTotal, 0);
      const total = g.transactionTotal ?? linesTotal;

      // ---- Match lines to products ----
      const lineCreates = g.lines.map((l) => {
        const productId = matchProduct(l.rawProductName, productIndex);
        if (productId) summary.linesMatched++;
        else summary.linesUnmatched++;
        return {
          productId,
          rawProductName: l.rawProductName,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          lineTotal: l.lineTotal,
        };
      });

      await prisma.transaction.create({
        data: {
          customerId,
          store: g.store,
          transactionDate: g.date ?? new Date(),
          storehubRef: g.ref,
          rawPhone: g.rawPhone || null,
          totalAmount: total,
          lines: { create: lineCreates },
        },
      });
      summary.transactionsCreated++;
    } catch (e) {
      summary.errors.push(`Group (ref ${g.ref ?? "none"}): ${(e as Error).message}`);
    }
  }

  revalidatePath("/");
  revalidatePath("/customers");
  return summary;
}
