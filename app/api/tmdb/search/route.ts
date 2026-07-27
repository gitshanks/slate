import { NextResponse } from "next/server";
import { appApiUnauthorizedResponse } from "@/lib/app-access";
import { searchMultiWithFallback } from "@/lib/tmdb";
import { type TitleRow } from "@/lib/supabase";
import { getLibraryClient } from "@/lib/library-db";

/** Shape we return for library hits — just enough for the palette row. */
type LibraryHit = Pick<
  TitleRow,
  | "id"
  | "tmdb_id"
  | "media_type"
  | "title"
  | "poster_path"
  | "release_date"
  | "imdb_rating"
  | "rt_score"
  | "metacritic_score"
  | "status"
>;

async function searchLibrary(q: string): Promise<LibraryHit[]> {
  try {
    const db = await getLibraryClient();
    const { data } = await db
      .from("titles")
      .select(
        "id, tmdb_id, media_type, title, poster_path, release_date, imdb_rating, rt_score, metacritic_score, status"
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
  const unauthorized = await appApiUnauthorizedResponse();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json({ library: [], results: [] });

  try {
    // Fire the library query and TMDB search in parallel — no waterfalls.
    const [library, search] = await Promise.all([
      searchLibrary(q.trim()),
      searchMultiWithFallback(q),
    ]);

    return NextResponse.json({
      library,
      results: search.results.slice(0, 12),
      approximate: search.approximate,
      approxQuery: search.approxQuery,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "TMDB error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
