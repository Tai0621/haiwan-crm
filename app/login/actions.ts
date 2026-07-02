"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, expectedToken, expectedStaffToken } from "@/lib/auth";

export async function login(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const mgmt = process.env.APP_PASSWORD ?? "";
  const staff = process.env.APP_PASSWORD_STAFF ?? "";

  // The password entered decides the role (management or frontline staff).
  let token: string | null = null;
  if (mgmt && password === mgmt) token = await expectedToken();
  else if (staff && password === staff) token = await expectedStaffToken();

  if (!token) {
    redirect("/login?error=1");
  }

  const store = await cookies();
  store.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // HTTPS-only once deployed
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  redirect("/");
}

export async function logout() {
  const store = await cookies();
  store.delete(AUTH_COOKIE);
  redirect("/login");
}
