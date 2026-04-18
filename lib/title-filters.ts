import "server-only";
import { unstable_cache } from "next/cache";
import { supabase, type TitleRow, type TitleStatus } from "@/lib/supabase";
import { extractGenres } from "@/lib/filter-utils";

// Re-export so callers that previously imported TitleFilterParams from here still work.
export type { TitleFilterParams } from "@/lib/filter-utils";

/**
 * Fetch ALL titles for a status — no filtering applied here.
 * Filtering/sorting happens client-side in FilteredGrid so it's instant.
 * Cached by Next.js; invalidated via revalidateTag("titles") on mutations.
 *
 * In demo mode we bypass the cache entirely: per-visitor cookie state cannot
 * be shared across requests, so caching would serve stale data to the visitor.
 */
const cachedQuery = unstable_cache(
  async (status: TitleStatus) => {
    const { data, error } = await supabase
      .from("titles")
      .select("*")
      .eq("status", status);
    return { data: (data ?? []) as TitleRow[], error };
  },
  ["titles-by-status"],
  { tags: ["titles"] }
);

async function liveQuery(status: TitleStatus) {
  const { data, error } = await supabase
    .from("titles")
    .select("*")
    .eq("status", status);
  return { data: (data ?? []) as TitleRow[], error };
}

export async function fetchTitlesByStatus(status: TitleStatus) {
  const query = process.env.NEXT_PUBLIC_DEMO_MODE === "1" ? liveQuery : cachedQuery;
  const { data, error } = await query(status);
  if (error) {
    return { titles: [] as TitleRow[], allGenres: [], error };
  }
  return { titles: data, allGenres: extractGenres(data), error: null };
}
