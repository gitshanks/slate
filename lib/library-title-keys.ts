import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const TITLE_KEY_PAGE_SIZE = 1000;

/**
 * Read every saved catalogue key without relying on PostgREST's default
 * 1,000-row response ceiling. The same range contract is implemented by the
 * Neon and demo adapters, so exclusion behavior is identical everywhere.
 */
export async function getAllLibraryTitleKeys(
  db: SupabaseClient,
): Promise<Set<string>> {
  const keys = new Set<string>();

  for (let from = 0; ; from += TITLE_KEY_PAGE_SIZE) {
    const { data, error } = await db
      .from("titles")
      .select("tmdb_id, media_type")
      .order("id", { ascending: true })
      .range(from, from + TITLE_KEY_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    for (const row of rows) {
      const tmdbId = Number(row.tmdb_id);
      if (!Number.isFinite(tmdbId) || tmdbId <= 0) continue;
      const mediaType = row.media_type === "tv" ? "tv" : "movie";
      keys.add(`${mediaType}:${tmdbId}`);
    }
    if (rows.length < TITLE_KEY_PAGE_SIZE) break;
  }

  return keys;
}
