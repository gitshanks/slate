// Pure helpers safe to import from client components.
// No API key, no fetching — just URL construction.

export const TMDB_IMG = "https://image.tmdb.org/t/p";

export function posterUrl(path: string | null | undefined, size = "w500") {
  if (!path) return null;
  return `${TMDB_IMG}/${size}${path}`;
}

export function backdropUrl(path: string | null | undefined, size = "w1280") {
  if (!path) return null;
  return `${TMDB_IMG}/${size}${path}`;
}
