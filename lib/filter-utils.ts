// Pure filter + sort logic — no server-only imports, safe to use in client components.

import type { TitleRow, TitleStatus } from "@/lib/types";

export interface TitleFilterParams {
  type?: string;
  genre?: string;
  year?: string;
  sort?: string;
  sentiment?: string;
}

function decadeRange(year: string): { start: number; end: number } | null {
  switch (year) {
    case "2020s": return { start: 2020, end: 2030 };
    case "2010s": return { start: 2010, end: 2020 };
    case "2000s": return { start: 2000, end: 2010 };
    case "older": return { start: 0, end: 2000 };
    default: return null;
  }
}

function parseYear(date: string | null): number | null {
  if (!date) return null;
  const n = Number(date.slice(0, 4));
  return Number.isFinite(n) ? n : null;
}

/**
 * Filter and sort an in-memory array of titles. Called client-side on every
 * searchParams change — no network roundtrip, instant results.
 */
export function filterAndSort(
  all: TitleRow[],
  status: TitleStatus,
  sp: TitleFilterParams
): TitleRow[] {
  let filtered = all;

  if (sp.type === "movie" || sp.type === "tv") {
    filtered = filtered.filter((t) => t.media_type === sp.type);
  }
  if (sp.sentiment) {
    const sentimentMap: Record<string, number> = { loved: 3, liked: 2, disliked: 1 };
    const ratingValue = sentimentMap[sp.sentiment];
    if (ratingValue !== undefined) {
      filtered = filtered.filter((t) => Number(t.rating) === ratingValue);
    }
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

  return sorted;
}

/** Extract the full genre list from an unfiltered title array. */
export function extractGenres(
  all: TitleRow[]
): { id: number; name: string }[] {
  const seen = new Map<number, string>();
  for (const t of all) {
    if (!t.genres) continue;
    for (const g of t.genres) {
      if (!seen.has(g.id)) seen.set(g.id, g.name);
    }
  }
  return Array.from(seen.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
