import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE = "slate-unlocked";

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

  // Demo mode is always open — no passcode gate. The public-portfolio
  // landing page rides on the same flag (see next.config.ts), so this single
  // check also keeps "/" and "/landing" reachable on the public deploy.
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "1") return NextResponse.next();

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
  // Run on every path except static assets, image optimizer, and the
  // build-id endpoint (non-sensitive; the UpdateBanner hits it from every
  // active tab on focus/visibility/pageshow, and proxy fires per request
  // even when the route resolves to a static CDN asset).
  matcher: ["/((?!_next/static|_next/image|api/version|.*\\..*).*)"],
};
