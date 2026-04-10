import "server-only";
import { supabase, type TitleRow, type TitleStatus } from "@/lib/supabase";

export interface TitleFilterParams {
  type?: string;
  genre?: string;
  year?: string;
  sort?: string;
}

/**
 * Half-open year range [start, end) for a decade keyword. Null for unknown.
 */
function decadeRange(year: string): { start: number; end: number } | null {
  switch (year) {
    case "2020s":
      return { start: 2020, end: 2030 };
    case "2010s":
      return { start: 2010, end: 2020 };
    case "2000s":
      return { start: 2000, end: 2010 };
    case "older":
      return { start: 0, end: 2000 };
    default:
      return null;
  }
}

function parseYear(date: string | null): number | null {
  if (!date) return null;
  const n = Number(date.slice(0, 4));
  return Number.isFinite(n) ? n : null;
}

/**
 * Fetch *all* titles with a given status, then apply filters + sort in JS.
 * Doing it this way keeps the FilterBar's genre dropdown populated with every
 * genre the user actually has (not just ones matching the current filter) —
 * we compute `allGenres` from the unfiltered set before slicing.
 *
 * For a personal library (hundreds to low thousands of titles) the
 * one-query-then-filter approach is both simpler and fast enough.
 */
export async function fetchTitlesByStatus(
  status: TitleStatus,
  sp: TitleFilterParams
) {
  const { data, error } = await supabase
    .from("titles")
    .select("*")
    .eq("status", status);

  if (error) {
    return { titles: [] as TitleRow[], allGenres: [], error };
  }

  const all = (data ?? []) as TitleRow[];

  // Build the full genre list from the unfiltered set so the dropdown is
  // stable as the user drills in.
  const seen = new Map<number, string>();
  for (const t of all) {
    if (!t.genres) continue;
    for (const g of t.genres) {
      if (!seen.has(g.id)) seen.set(g.id, g.name);
    }
  }
  const allGenres = Array.from(seen.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Apply filters
  let filtered = all;
  if (sp.type === "movie" || sp.type === "tv") {
    filtered = filtered.filter((t) => t.media_type === sp.type);
  }
  if (sp.genre) {
    const genreId = Number(sp.genre);
    if (Number.isFinite(genreId)) {
      filtered = filtered.filter((t) =>
        t.genres?.some((g) => g.id === genreId) ?? false
      );
    }
  }
  if (sp.year) {
    const range = decadeRange(sp.year);
    if (range) {
      filtered = filtered.filter((t) => {
        const y = parseYear(t.release_date);
        return y != null && y >= range.start && y < range.end;
      });
    }
  }

  // Apply sort
  const sorted = [...filtered];
  switch (sp.sort) {
    case "rating":
      sorted.sort((a, b) => {
        const av = Number(a.tmdb_rating ?? -Infinity);
        const bv = Number(b.tmdb_rating ?? -Infinity);
        return bv - av;
      });
      break;
    case "year":
      sorted.sort((a, b) => {
        const ay = parseYear(a.release_date) ?? -Infinity;
        const by = parseYear(b.release_date) ?? -Infinity;
        return by - ay;
      });
      break;
    default:
      // Default sort depends on status: watched → watched_at, else added_at
      if (status === "watched") {
        sorted.sort((a, b) => {
          const at = a.watched_at ? Date.parse(a.watched_at) : 0;
          const bt = b.watched_at ? Date.parse(b.watched_at) : 0;
          return bt - at;
        });
      } else {
        sorted.sort(
          (a, b) => Date.parse(b.added_at) - Date.parse(a.added_at)
        );
      }
      break;
  }

  return { titles: sorted, allGenres, error: null };
}
