import { NextResponse } from "next/server";
import {
  aiSearchEnabled,
  parseSearchIntent,
  intentToDiscoverParams,
  type SearchIntent,
} from "@/lib/ai-search";
import { discover, searchMulti, type TmdbMediaResult } from "@/lib/tmdb";
import { supabase, type TitleRow } from "@/lib/supabase";

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

/**
 * Look up library titles by free-text. Mirrors `/api/tmdb/search`'s library
 * lookup so AI mode still surfaces things you've already saved when relevant.
 */
async function searchLibrary(q: string): Promise<LibraryHit[]> {
  if (!q) return [];
  try {
    const { data } = await supabase
      .from("titles")
      .select(
        "id, tmdb_id, media_type, title, poster_path, release_date, imdb_rating, rt_score, metacritic_score, status",
      )
      .ilike("title", `%${q}%`)
      .order("added_at", { ascending: false })
      .limit(6);
    return (data as LibraryHit[] | null) ?? [];
  } catch {
    return [];
  }
}

/**
 * Run the structured intent against TMDB. If the user's query implied a
 * keyword (a title, person, or franchise), we still feed it through
 * /search/multi — that's how "Christopher Nolan" surfaces his films. Otherwise
 * we hit /discover with the parsed filters (genre, year, sort, min-rating).
 */
async function executeIntent(intent: SearchIntent): Promise<TmdbMediaResult[]> {
  const wantMovie = intent.media_type !== "tv";
  const wantTv = intent.media_type !== "movie";

  // Branch 1 — free-text keyword. /search/multi is fuzzier than /discover.
  if (intent.query_text && intent.query_text.trim().length >= 2) {
    const search = await searchMulti(intent.query_text.trim());
    return search.results.filter(
      (r): r is TmdbMediaResult =>
        (r.media_type === "movie" && wantMovie) ||
        (r.media_type === "tv" && wantTv),
    );
  }

  // Branch 2 — discover by filters. Run both media types in parallel when
  // the user didn't constrain it, then interleave.
  const [movieHits, tvHits] = await Promise.all([
    wantMovie ? discover("movie", intentToDiscoverParams(intent, "movie")) : Promise.resolve([]),
    wantTv ? discover("tv", intentToDiscoverParams(intent, "tv")) : Promise.resolve([]),
  ]);

  if (intent.media_type === "movie") return movieHits;
  if (intent.media_type === "tv") return tvHits;

  // Interleave so neither side dominates the list.
  const interleaved: TmdbMediaResult[] = [];
  const max = Math.max(movieHits.length, tvHits.length);
  for (let i = 0; i < max; i++) {
    if (movieHits[i]) interleaved.push(movieHits[i]);
    if (tvHits[i]) interleaved.push(tvHits[i]);
  }
  return interleaved;
}

export async function POST(request: Request) {
  if (!aiSearchEnabled) {
    return NextResponse.json(
      { error: "AI search is not configured. Set ANTHROPIC_API_KEY." },
      { status: 503 },
    );
  }
  let query = "";
  try {
    const body = await request.json();
    query = typeof body?.query === "string" ? body.query : "";
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!query.trim()) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  try {
    const intent = await parseSearchIntent(query);
    const [results, library] = await Promise.all([
      executeIntent(intent),
      searchLibrary(intent.query_text ?? query),
    ]);
    return NextResponse.json({
      intent,
      library,
      results: results.slice(0, 16),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
