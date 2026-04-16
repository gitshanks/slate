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

export async function fetchTitlesByStatus(status: TitleStatus) {
  const { data, error } = await cachedQuery(status);
  if (error) {
    return { titles: [] as TitleRow[], allGenres: [], error };
  }
  return { titles: data, allGenres: extractGenres(data), error: null };
}
