"use server";

import { syncWixInventory, type WixSyncSummary } from "@/lib/wix";
import { revalidatePath } from "next/cache";

export async function runWixSync(): Promise<WixSyncSummary> {
  const summary = await syncWixInventory();
  revalidatePath("/wix");
  revalidatePath("/products");
  return summary;
}
