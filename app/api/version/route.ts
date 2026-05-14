import { NextResponse } from "next/server";

// force-static makes Next pre-render this route as a JSON file at build
// time and serve it from the CDN edge on every subsequent request — no
// function invocations per ping. Each new deploy regenerates the file
// with that build's id, so stale clients still detect the mismatch when
// they fetch it. (Previous force-dynamic + no-store cost one function
// invocation per client ping; over many installed PWAs that adds up to
// a Vercel fair-use flag.)
export const dynamic = "force-static";

export function GET() {
  return NextResponse.json({
    buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev",
  });
}
