"use server";

import { revalidatePath } from "next/cache";
import {
  syncStoreHubTransactions,
  syncStoreHubCustomers,
  type StoreHubTransactionSyncSummary,
  type StoreHubCustomerSyncSummary,
} from "@/lib/storehub";

export async function runStoreHubTransactionSync(
  days = 7,
): Promise<StoreHubTransactionSyncSummary> {
  const summary = await syncStoreHubTransactions(days);
  revalidatePath("/transactions");
  revalidatePath("/customers");
  revalidatePath("/");
  revalidatePath("/revenue");
  return summary;
}

export async function runStoreHubCustomerSync(): Promise<StoreHubCustomerSyncSummary> {
  const summary = await syncStoreHubCustomers();
  revalidatePath("/customers");
  return summary;
}
