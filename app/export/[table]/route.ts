import { prisma } from "@/lib/db";
import { monthlyMarginMix } from "@/lib/analytics";
import Papa from "papaparse";

// =============================================================================
// CSV export — one route per table. Exports RAW columns (including ids and
// foreign keys) so the data is a faithful, reconstructable migration artifact
// for the future system. Dates are emitted as ISO-8601 strings.
//
//   GET /export/customers   /export/pets   /export/products
//       /export/transactions   /export/lines   /export/subscriptions
// =============================================================================

export const dynamic = "force-dynamic";

function iso(d: Date | null | undefined): string {
  return d ? d.toISOString() : "";
}

type Rows = Record<string, string | number | boolean | null>[];

async function buildRows(table: string): Promise<Rows | null> {
  switch (table) {
    case "customers": {
      const rows = await prisma.customer.findMany({ orderBy: { createdAt: "asc" } });
      return rows.map((c) => ({
        id: c.id,
        phone: c.phone,
        name: c.name,
        email: c.email,
        preferredStore: c.preferredStore,
        marketingConsent: c.marketingConsent,
        consentDate: iso(c.consentDate),
        source: c.source,
        needsDetails: c.needsDetails,
        memberStatus: c.memberStatus,
        memberId: c.memberId,
        joinDate: iso(c.joinDate),
        claimedDate: iso(c.claimedDate),
        pointsBalance: c.pointsBalance,
        posLoyaltyPoints: c.posLoyaltyPoints,
        notes: c.notes,
        createdAt: iso(c.createdAt),
        updatedAt: iso(c.updatedAt),
      }));
    }
    case "pets": {
      const rows = await prisma.pet.findMany({ orderBy: { createdAt: "asc" } });
      return rows.map((p) => ({
        id: p.id,
        customerId: p.customerId,
        name: p.name,
        species: p.species,
        breed: p.breed,
        dateOfBirth: iso(p.dateOfBirth),
        approxAgeMonths: p.approxAgeMonths,
        weightKg: p.weightKg,
        lifeStage: p.lifeStage,
        dietaryNotes: p.dietaryNotes,
        allergies: p.allergies,
        createdAt: iso(p.createdAt),
        updatedAt: iso(p.updatedAt),
      }));
    }
    case "products": {
      const rows = await prisma.product.findMany({ orderBy: { sku: "asc" } });
      return rows.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        brand: p.brand,
        category: p.category,
        targetSpecies: p.targetSpecies,
        lifeStage: p.lifeStage,
        packSize: p.packSize,
        packUnit: p.packUnit,
        supplierType: p.supplierType,
        costPrice: p.costPrice,
        retailPrice: p.retailPrice,
        isConsumable: p.isConsumable,
        createdAt: iso(p.createdAt),
        updatedAt: iso(p.updatedAt),
      }));
    }
    case "transactions": {
      const rows = await prisma.transaction.findMany({ orderBy: { transactionDate: "asc" } });
      return rows.map((t) => ({
        id: t.id,
        customerId: t.customerId,
        store: t.store,
        transactionDate: iso(t.transactionDate),
        storehubRef: t.storehubRef,
        rawPhone: t.rawPhone,
        totalAmount: t.totalAmount,
        createdAt: iso(t.createdAt),
      }));
    }
    case "lines": {
      const rows = await prisma.transactionLine.findMany();
      return rows.map((l) => ({
        id: l.id,
        transactionId: l.transactionId,
        productId: l.productId,
        petId: l.petId,
        rawProductName: l.rawProductName,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        lineTotal: l.lineTotal,
      }));
    }
    case "subscriptions": {
      const rows = await prisma.subscription.findMany({ orderBy: { createdAt: "asc" } });
      return rows.map((s) => ({
        id: s.id,
        customerId: s.customerId,
        petId: s.petId,
        productId: s.productId,
        intervalDays: s.intervalDays,
        nextDueDate: iso(s.nextDueDate),
        status: s.status,
        createdAt: iso(s.createdAt),
        updatedAt: iso(s.updatedAt),
      }));
    }
    case "tasks": {
      const rows = await prisma.task.findMany({ orderBy: { createdAt: "asc" } });
      return rows.map((t) => ({
        id: t.id,
        type: t.type,
        source: t.source,
        channel: t.channel,
        store: t.store,
        customerId: t.customerId,
        petId: t.petId,
        productId: t.productId,
        brandId: t.brandId,
        dueAt: iso(t.dueAt),
        status: t.status,
        note: t.note,
        holdItem: t.holdItem,
        holdExpiresAt: iso(t.holdExpiresAt),
        snoozedUntil: iso(t.snoozedUntil),
        createdAt: iso(t.createdAt),
        completedAt: iso(t.completedAt),
      }));
    }
    case "brands": {
      const rows = await prisma.brand.findMany({ orderBy: { name: "asc" } });
      return rows.map((b) => ({
        id: b.id,
        name: b.name,
        website: b.website,
        country: b.country,
        supplierType: b.supplierType,
        status: b.status,
        owner: b.owner,
        nextStep: b.nextStep,
        listingFee: b.listingFee,
        commissionPct: b.commissionPct,
        trialStartDate: iso(b.trialStartDate),
        aestheticFit: b.aestheticFit,
        notes: b.notes,
        createdAt: iso(b.createdAt),
        updatedAt: iso(b.updatedAt),
      }));
    }
    case "finance": {
      // Long-format margin report: one row per month × supplier type, so it
      // reconciles line-by-line against the management accounts.
      const months = await monthlyMarginMix();
      const rows: Rows = [];
      for (const m of months) {
        for (const k of ["INHOUSE", "CONSIGNMENT", "TRADING", "UNCLASSIFIED"] as const) {
          if (m[k].revenue === 0 && m[k].cogs === 0) continue;
          rows.push({
            month: m.month,
            supplierType: k,
            revenue: m[k].revenue,
            cogs: k === "UNCLASSIFIED" ? "" : m[k].cogs,
            grossProfit: k === "UNCLASSIFIED" ? "" : m[k].grossProfit,
          });
        }
      }
      return rows;
    }
    case "shiftchecklist": {
      const rows = await prisma.shiftChecklistItem.findMany({ orderBy: [{ sectionOrder: "asc" }, { sortOrder: "asc" }] });
      return rows.map((i) => ({
        id: i.id,
        section: i.section,
        sectionOrder: i.sectionOrder,
        sortOrder: i.sortOrder,
        shift: i.shift,
        label: i.label,
        note: i.note,
        priority: i.priority,
        storeKL: i.storeKL,
        storePJ: i.storePJ,
        active: i.active,
        updatedAt: iso(i.updatedAt),
      }));
    }
    case "shiftlogs": {
      const rows = await prisma.shiftLog.findMany({ orderBy: { signedAt: "asc" } });
      return rows.map((l) => ({
        id: l.id,
        shift: l.shift,
        store: l.store,
        businessDate: iso(l.businessDate),
        staffName: l.staffName,
        itemsTotal: l.itemsTotal,
        itemsDone: l.itemsDone,
        checkedItems: l.checkedItems,
        remarks: l.remarks,
        supervisorName: l.supervisorName,
        signedAt: iso(l.signedAt),
        createdAt: iso(l.createdAt),
      }));
    }
    case "refilloverlays": {
      const rows = await prisma.refillOverlay.findMany({ orderBy: { createdAt: "asc" } });
      return rows.map((o) => ({
        id: o.id,
        customerId: o.customerId,
        productId: o.productId,
        cycleDate: iso(o.cycleDate),
        status: o.status,
        snoozedUntil: iso(o.snoozedUntil),
        createdAt: iso(o.createdAt),
        updatedAt: iso(o.updatedAt),
      }));
    }
    default:
      return null;
  }
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ table: string }> },
) {
  const { table } = await ctx.params;
  const rows = await buildRows(table);

  if (rows === null) {
    return new Response(`Unknown table: ${table}`, { status: 404 });
  }

  // Papa.unparse handles quoting/escaping. Empty table -> header-less empty file
  // is unhelpful, so emit at least an empty string.
  const csv = rows.length > 0 ? Papa.unparse(rows) : "";
  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="haiwan-${table}-${date}.csv"`,
    },
  });
}
