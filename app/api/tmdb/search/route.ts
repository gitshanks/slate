import { NextResponse } from "next/server";
import { searchMulti, type TmdbSearchResult } from "@/lib/tmdb";
import { supabase, type TitleRow } from "@/lib/supabase";

type Filtered = TmdbSearchResult & { media_type: "movie" | "tv" };

function filterMedia(results: TmdbSearchResult[]): Filtered[] {
  return results.filter(
    (r): r is Filtered => r.media_type === "movie" || r.media_type === "tv"
  );
}

/** Shape we return for library hits — just enough for the palette row. */
type LibraryHit = Pick<
  TitleRow,
  | "id"
  | "tmdb_id"
  | "media_type"
  | "title"
  | "poster_path"
  | "release_date"
  | "tmdb_rating"
  | "status"
>;

async function searchLibrary(q: string): Promise<LibraryHit[]> {
  try {
    const { data } = await supabase
      .from("titles")
      .select(
        "id, tmdb_id, media_type, title, poster_path, release_date, tmdb_rating, status"
      )
      .ilike("title", `%${q}%`)
      .order("added_at", { ascending: false })
      .limit(8);
    return (data as LibraryHit[] | null) ?? [];
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json({ library: [], results: [] });

  try {
    // Fire the library query and TMDB search in parallel — no waterfalls.
    const [library, first] = await Promise.all([
      searchLibrary(q.trim()),
      searchMulti(q),
    ]);

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

    return NextResponse.json({ library, results, approximate, approxQuery });
  } catch (err) {
    const message = err instanceof Error ? err.message : "TMDB error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
