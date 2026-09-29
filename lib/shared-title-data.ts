import "server-only";

import { cache } from "react";
import { getMovie, getTv, normalizeForStorage } from "@/lib/tmdb";
import { parseSharedTitle } from "@/lib/title-sharing";

/** Public catalogue only: never read a sender's library, identity, or notes. */
export const getSharedTitle = cache(async (type: string, rawId: string) => {
  const parsed = parseSharedTitle(type, rawId);
  if (!parsed) return null;
  try {
    const detail = parsed.mediaType === "movie" ? await getMovie(parsed.tmdbId) : await getTv(parsed.tmdbId);
    const title = normalizeForStorage(parsed.mediaType, detail);
    return {
      tmdb_id: title.tmdb_id,
      media_type: title.media_type,
      title: title.title,
      overview: title.overview,
      poster_path: title.poster_path,
      backdrop_path: title.backdrop_path,
      release_date: title.release_date,
      genres: title.genres,
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("TMDB 404 ")) return null;
    throw error;
  }
});
