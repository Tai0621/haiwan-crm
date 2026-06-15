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
  // Run on everything EXCEPT: the login page, /api routes, Next internals, and
  // favicon. /api is excluded because those endpoints are called by external
  // services (Typeform/WhatsApp webhooks, Vercel Cron) that have no login
  // cookie — they authenticate themselves (HMAC signature / CRON_SECRET). If
  // the gate ran on them it would 307-redirect every call to /login, so the
  // webhook ingest and the scheduled syncs would silently never run.
  matcher: ["/((?!login|api|_next/static|_next/image|favicon.ico).*)"],
};
