import "server-only";
import { supabase, type TitleRow, type TitleStatus } from "@/lib/supabase";
import { extractGenres } from "@/lib/filter-utils";

// Re-export so callers that previously imported TitleFilterParams from here still work.
export type { TitleFilterParams } from "@/lib/filter-utils";

export async function fetchTitlesByStatus(status: TitleStatus) {
  const { data, error } = await supabase
    .from("titles")
    .select("*")
    .eq("status", status)
    .order("position", { ascending: true })
    .order(status === "watched" ? "watched_at" : "added_at", {
      ascending: false,
    });
  if (error) {
    return { titles: [] as TitleRow[], allGenres: [], error };
  }
  const titles = (data ?? []) as TitleRow[];
  return { titles, allGenres: extractGenres(titles), error: null };
}
