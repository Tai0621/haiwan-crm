"use server";

import { prisma } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/** Set leadership's target in-house revenue share (0–100%). */
export async function setInhouseTarget(formData: FormData) {
  if (!(await isAuthenticated())) throw new Error("Unauthorized");
  const raw = parseFloat(String(formData.get("targetInhousePct") ?? "0"));
  const pct = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 0;
  await prisma.appSetting.upsert({
    where: { id: "default" },
    update: { targetInhousePct: pct },
    create: { id: "default", targetInhousePct: pct },
  });
  revalidatePath("/finance");
}
