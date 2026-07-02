"use server";

import { prisma } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface ShiftLogInput {
  shift: "OPENING" | "CLOSING";
  store: "KL" | "PJ" | "NONE";
  businessDate: string; // YYYY-MM-DD
  staffName: string;
  checkedItems: string[];
  itemsTotal: number;
  remarks: string;
  supervisorName: string;
}

/** Save a signed-off shift checklist. Either role may submit. */
export async function submitShiftLog(input: ShiftLogInput) {
  if (!(await isAuthenticated())) throw new Error("Unauthorized");
  const staffName = input.staffName.trim();
  if (!staffName) throw new Error("Staff name is required.");

  const date = input.businessDate ? new Date(input.businessDate) : new Date();
  await prisma.shiftLog.create({
    data: {
      shift: input.shift,
      store: input.store,
      businessDate: isNaN(date.getTime()) ? new Date() : date,
      staffName,
      itemsTotal: input.itemsTotal,
      itemsDone: input.checkedItems.length,
      checkedItems: JSON.stringify(input.checkedItems),
      remarks: input.remarks.trim() || null,
      supervisorName: input.supervisorName.trim() || null,
    },
  });

  revalidatePath("/shift");
}
