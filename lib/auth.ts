// =============================================================================
// Minimal shared-password auth with two roles.
//
//   management — APP_PASSWORD        — sees everything.
//   frontline  — APP_PASSWORD_STAFF  — Inbox + Customers + Transactions only.
//
// One login form; the password entered decides the role. The session cookie's
// value is the SHA-256 of a ROLE-SPECIFIC secret, so the role is baked into the
// token and can't be forged or escalated without knowing that role's password.
// The proxy validates it statelessly (no session store).
//
// Intentionally lightweight — an internal tool for a few staff, not a
// public-facing auth system.
// =============================================================================

export const AUTH_COOKIE = "haiwan_auth";

export type Role = "management" | "frontline";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Management token — SHA-256 of "haiwan:<APP_PASSWORD>". Formula unchanged from
 * the single-role version, so existing management sessions stay valid.
 */
export async function expectedToken(): Promise<string> {
  return sha256Hex("haiwan:" + (process.env.APP_PASSWORD ?? ""));
}

/**
 * Frontline token — SHA-256 of "haiwan:frontline:<APP_PASSWORD_STAFF>". Returns
 * null when no staff password is configured (i.e. the frontline account is off).
 */
export async function expectedStaffToken(): Promise<string | null> {
  const pw = process.env.APP_PASSWORD_STAFF;
  if (!pw) return null;
  return sha256Hex("haiwan:frontline:" + pw);
}

/**
 * Map a cookie token to its role, or null if it matches neither. Pure (no
 * next/headers) so it's safe to call from the edge proxy.
 */
export async function roleForToken(token: string | undefined | null): Promise<Role | null> {
  if (!token) return null;
  if (token === (await expectedToken())) return "management";
  const staff = await expectedStaffToken();
  if (staff && token === staff) return "frontline";
  return null;
}

/** The role of the current request (reads the session cookie). */
export async function currentRole(): Promise<Role | null> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  return roleForToken(store.get(AUTH_COOKIE)?.value);
}

/**
 * True when the current request is authenticated (either role). The proxy gates
 * navigation, but Server Actions are reachable by direct POST, so action
 * handlers call this to re-verify before mutating.
 */
export async function isAuthenticated(): Promise<boolean> {
  return (await currentRole()) !== null;
}

/** Throws unless the current request is a management session. */
export async function requireManagement(): Promise<void> {
  if ((await currentRole()) !== "management") throw new Error("Forbidden");
}

// ---------------------------------------------------------------------------
// Frontline authorization — the pages a frontline session may reach. Everything
// else is management-only. Used by the proxy (route gating) and the nav.
// ---------------------------------------------------------------------------
export const FRONTLINE_PREFIXES = ["/customers", "/pets", "/members", "/transactions"];

export function frontlineCanAccess(pathname: string): boolean {
  if (pathname === "/") return true;
  return FRONTLINE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
