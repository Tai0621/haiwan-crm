"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function createSubscription(formData: FormData) {
  const customerId = String(formData.get("customerId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const petIdRaw = String(formData.get("petId") ?? "");
  const intervalDays = parseInt(String(formData.get("intervalDays") ?? "30"), 10);
  const nextDueRaw = String(formData.get("nextDueDate") ?? "");

  if (!customerId || !productId) throw new Error("Customer and product are required.");

  await prisma.subscription.create({
    data: {
      customerId,
      productId,
      petId: petIdRaw || null,
      intervalDays: Number.isFinite(intervalDays) && intervalDays > 0 ? intervalDays : 30,
      nextDueDate: nextDueRaw ? new Date(nextDueRaw) : new Date(),
      status: (formData.get("status") as "ACTIVE" | "PAUSED" | "CANCELLED") || "ACTIVE",
    },
  });

  revalidatePath("/subscriptions");
  revalidatePath("/");
}

export async function updateSubscriptionStatus(formData: FormData) {
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as "ACTIVE" | "PAUSED" | "CANCELLED";
  await prisma.subscription.update({ where: { id }, data: { status } });
  revalidatePath("/subscriptions");
  revalidatePath("/");
}

export async function deleteSubscription(formData: FormData) {
  const id = String(formData.get("id"));
  await prisma.subscription.delete({ where: { id } });
  revalidatePath("/subscriptions");
  revalidatePath("/");
}
