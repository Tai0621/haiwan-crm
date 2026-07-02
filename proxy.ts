// =============================================================================
// Auth gate (Next.js "proxy" — formerly middleware).
//   • No valid session cookie  → redirect to /login.
//   • Frontline session on a management-only page → redirect to the Inbox ("/").
// The cookie encodes the role (see lib/auth.ts roleForToken); frontline access
// is limited to the pages in frontlineCanAccess().
//
// The matcher excludes /login and Next's static assets so the login screen and
// the framework's own files are always reachable.
// =============================================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, roleForToken, frontlineCanAccess } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const cookie = request.cookies.get(AUTH_COOKIE)?.value;
  const role = await roleForToken(cookie);

  if (!role) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Frontline staff can only reach their allowed pages; bounce the rest home.
  if (role === "frontline" && !frontlineCanAccess(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
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
