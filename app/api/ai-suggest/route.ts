import { NextResponse } from "next/server";
import { aiSearchEnabled, suggestQueries } from "@/lib/ai-search";

export async function GET(request: Request) {
  if (!aiSearchEnabled) {
    return NextResponse.json({ suggestions: [] });
  }
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }
  const suggestions = await suggestQueries(q);
  return NextResponse.json(
    { suggestions },
    {
      headers: {
        // Identical partials hit the same suggestions for a few minutes —
        // saves Claude tokens on repeat keystrokes after a backspace.
        "Cache-Control": "private, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
