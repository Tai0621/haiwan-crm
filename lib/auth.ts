// =============================================================================
// Minimal shared-password auth.
//
// A single APP_PASSWORD env var gates the whole app. On login we store a cookie
// whose value is the SHA-256 of the password (not the plaintext) so the proxy
// can validate it statelessly without a session store. Anyone without the
// password can't forge the cookie because they can't produce the right hash.
//
// This is intentionally lightweight — it's an internal tool for a few staff,
// not a public-facing auth system.
// =============================================================================

export const AUTH_COOKIE = "haiwan_auth";

/** SHA-256 hex of "haiwan:<APP_PASSWORD>" — the expected cookie value. */
export async function expectedToken(): Promise<string> {
  const pw = process.env.APP_PASSWORD ?? "";
  const data = new TextEncoder().encode("haiwan:" + pw);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
