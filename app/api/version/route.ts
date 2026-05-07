import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export function GET() {
  return NextResponse.json(
    { buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev" },
    {
      headers: {
        // Hard-disable every layer of caching: browser, Vercel edge, any
        // intermediate CDN. The whole point of this endpoint is to expose
        // the live server's build id, so a cached response defeats it.
        "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
        "cdn-cache-control": "no-store",
        "vercel-cdn-cache-control": "no-store",
        pragma: "no-cache",
      },
    },
  );
}
