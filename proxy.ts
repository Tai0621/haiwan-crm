// =============================================================================
// Auth gate (Next.js "proxy" — formerly middleware).
// Redirects any unauthenticated request to /login. The session cookie's value
// must equal SHA-256("haiwan:" + APP_PASSWORD); see lib/auth.ts.
//
// The matcher excludes /login and Next's static assets so the login screen and
// the framework's own files are always reachable.
// =============================================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, expectedToken } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const cookie = request.cookies.get(AUTH_COOKIE)?.value;
  const expected = await expectedToken();

  if (cookie && cookie === expected) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything EXCEPT: the login page, Next internals, and favicon.
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
