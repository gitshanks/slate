import "server-only";

import { getOmdbMetadata } from "@/lib/omdb";
import { buildSpatialTitleDetail } from "@/lib/spatial-title-detail";
import { getMovie, getTv, normalizeForStorage } from "@/lib/tmdb";
import type { PublicSpatialTitleDetail } from "@/lib/public-spatial-detail-types";
import type { TitleRow } from "@/lib/types";

/** Resolve catalogue metadata without consulting a library or account. */
export async function buildPublicCatalogueDetail(
  mediaType: "movie" | "tv",
  tmdbId: number,
): Promise<PublicSpatialTitleDetail> {
  const catalogue =
    mediaType === "movie" ? await getMovie(tmdbId) : await getTv(tmdbId);
  const normalized = normalizeForStorage(mediaType, catalogue);
  const omdb = normalized.imdb_id
    ? await getOmdbMetadata(normalized.imdb_id)
    : null;
  const resolvedTitle: TitleRow = {
    ...normalized,
    id: `discover-${mediaType}-${tmdbId}`,
    overview: omdb?.omdb_plot || normalized.overview,
    omdb_plot: omdb?.omdb_plot ?? null,
    omdb_plot_fetched_at: null,
    status: "want",
    rating: null,
    review: null,
    favorite: false,
    added_at: new Date(0).toISOString(),
    watched_at: null,
    imdb_rating: omdb?.imdb_rating ?? null,
    imdb_votes: omdb?.imdb_votes ?? null,
    rt_score: omdb?.rt_score ?? null,
    metacritic_score: omdb?.metacritic_score ?? null,
    ratings_fetched_at: null,
    current_season: null,
    current_episode: null,
    seasons: normalized.seasons ?? null,
  };

  // Use the same credits, providers, trailer, and recommendation serializer
  // as Slate's collection inspectors. The synthetic row has no private data.
  const detail = await buildSpatialTitleDetail(resolvedTitle);
  return { ...detail, resolvedTitle, savedTitle: null };
}
