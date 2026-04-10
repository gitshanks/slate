import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE = "watchlist-unlocked";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow the unlock page itself, the unlock POST, and Next internals.
  if (
    pathname.startsWith("/unlock") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api/unlock")
  ) {
    return NextResponse.next();
  }

  const passcode = process.env.APP_PASSCODE;
  // If no passcode is configured, the app is open (useful for first-run).
  if (!passcode) return NextResponse.next();

  const cookie = request.cookies.get(COOKIE)?.value;
  if (cookie === passcode) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/unlock";
  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Run on every path except static assets and image optimizer
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
