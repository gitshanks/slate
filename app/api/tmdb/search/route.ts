import { NextResponse } from "next/server";
import { searchMulti, type TmdbSearchResult } from "@/lib/tmdb";

type Filtered = TmdbSearchResult & { media_type: "movie" | "tv" };

function filterMedia(results: TmdbSearchResult[]): Filtered[] {
  return results.filter(
    (r): r is Filtered => r.media_type === "movie" || r.media_type === "tv"
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json({ results: [] });

  try {
    // First pass: exact query
    const first = await searchMulti(q);
    let results = filterMedia(first.results).slice(0, 12);
    let approximate = false;
    let approxQuery: string | null = null;

    // Fuzzy retry: progressively drop trailing words up to 2 times
    if (results.length === 0) {
      const words = q.trim().split(/\s+/);
      for (let drop = 1; drop <= 2 && words.length - drop >= 1; drop++) {
        const retryQuery = words.slice(0, words.length - drop).join(" ");
        if (!retryQuery) break;
        const retry = await searchMulti(retryQuery);
        const retryResults = filterMedia(retry.results).slice(0, 12);
        if (retryResults.length > 0) {
          results = retryResults;
          approximate = true;
          approxQuery = retryQuery;
          break;
        }
      }
    }

    return NextResponse.json({ results, approximate, approxQuery });
  } catch (err) {
    const message = err instanceof Error ? err.message : "TMDB error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
