import "server-only";
import { searchAll, type TmdbMediaResult, type TmdbPersonResult } from "@/lib/tmdb";
import { type TitleRow } from "@/lib/supabase";
import { getLibraryClient } from "@/lib/library-db";

/** Titles in the user's library whose name matches the query. */
async function searchLibrary(q: string): Promise<TitleRow[]> {
  try {
    const db = await getLibraryClient();
    const { data } = await db
      .from("titles")
      .select("*")
      .ilike("title", `%${q}%`)
      .order("added_at", { ascending: false })
      .limit(18);
    return (data as TitleRow[] | null) ?? [];
  } catch {
    return [];
  }
}

/** Of the given TMDB ids, which are already saved to the library. */
export async function savedAmong(tmdbIds: number[]): Promise<Set<number>> {
  if (tmdbIds.length === 0) return new Set();
  try {
    const db = await getLibraryClient();
    const { data } = await db
      .from("titles")
      .select("tmdb_id")
      .in("tmdb_id", tmdbIds);
    return new Set(((data as { tmdb_id: number }[] | null) ?? []).map((r) => r.tmdb_id));
  } catch {
    return new Set();
  }
}

export interface SearchEverythingResult {
  library: TitleRow[];
  media: TmdbMediaResult[];
  people: TmdbPersonResult[];
  savedTmdbIds: Set<number>;
  approximate: boolean;
  approxQuery: string | null;
}

/**
 * Everything the `/search` results page needs, fetched without waterfalls:
 * the TMDB titles + people, the user's matching library titles, and the set
 * of TMDB ids already saved (so result tiles can show a "Saved" badge). The
 * saved lookup depends on the TMDB ids, so it runs after `searchAll`; the
 * library query runs alongside.
 */
export async function searchEverything(query: string): Promise<SearchEverythingResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      library: [],
      media: [],
      people: [],
      savedTmdbIds: new Set(),
      approximate: false,
      approxQuery: null,
    };
  }

  const [tmdb, library] = await Promise.all([searchAll(trimmed), searchLibrary(trimmed)]);
  const savedTmdbIds = await savedAmong(tmdb.media.map((m) => m.id));

  return {
    library,
    media: tmdb.media,
    people: tmdb.people,
    savedTmdbIds,
    approximate: tmdb.approximate,
    approxQuery: tmdb.approxQuery,
  };
}
