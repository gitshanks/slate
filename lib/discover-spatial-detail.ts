import "server-only";

import { getNativeDiscoverDetail } from "@/lib/native-api/catalog";
import { formatPlotText } from "@/lib/plot-format";
import type { PublicSpatialTitleDetail } from "@/lib/public-spatial-detail-types";
import type { TitleRow } from "@/lib/types";

/**
 * Adapt the catalogue detail used by the native clients into the same compact
 * inspector payload used by Library Shelf and Space. TMDB detail, credits,
 * recommendations, trailer, and providers are still resolved by one shared
 * server path; this layer only changes field names for the web inspector.
 */
export async function buildDiscoverSpatialTitleDetail(
  ownerId: string,
  mediaType: "movie" | "tv",
  tmdbId: number,
): Promise<PublicSpatialTitleDetail> {
  const payload = await getNativeDiscoverDetail(ownerId, mediaType, tmdbId);
  const source = payload.savedTitle ?? payload.title;
  const summary = formatPlotText(payload.title.overview);
  const savedStatus = payload.savedTitle?.status;
  const status =
    savedStatus === "watching" || savedStatus === "watched"
      ? savedStatus
      : "want";

  const resolvedTitle: TitleRow = {
    id: payload.savedTitle?.id ?? `discover-${mediaType}-${tmdbId}`,
    tmdb_id: tmdbId,
    media_type: mediaType,
    title: source.title,
    original_title: source.originalTitle,
    overview: summary,
    omdb_plot: summary,
    omdb_plot_fetched_at: null,
    poster_path: source.posterPath,
    backdrop_path: source.backdropPath,
    release_date: source.releaseDate,
    runtime: source.runtime,
    genres: source.genres,
    status,
    rating: payload.savedTitle?.rating ?? null,
    review: payload.savedTitle?.review ?? null,
    favorite: payload.savedTitle?.favorite ?? false,
    added_at: payload.savedTitle?.addedAt ?? new Date(0).toISOString(),
    updated_at: payload.savedTitle?.updatedAt,
    watched_at: payload.savedTitle?.watchedAt ?? null,
    position: payload.savedTitle?.position,
    tmdb_rating: source.tmdbRating,
    tmdb_vote_count: payload.savedTitle?.tmdbVoteCount ?? null,
    imdb_id: source.imdbId,
    imdb_rating: source.imdbRating,
    imdb_votes: payload.savedTitle?.imdbVotes ?? null,
    rt_score: source.rottenTomatoesScore,
    metacritic_score: source.metacriticScore,
    ratings_fetched_at: null,
    current_season: payload.savedTitle?.currentSeason ?? null,
    current_episode: payload.savedTitle?.currentEpisode ?? null,
    seasons: payload.savedTitle?.seasons ?? null,
  };

  return {
    resolvedTitle,
    savedTitle: payload.savedTitle
      ? { id: payload.savedTitle.id, status }
      : null,
    summary,
    tagline: payload.tagline,
    trailerKey: payload.trailerKey,
    directedBy: payload.directedBy,
    cast: payload.cast.slice(0, 10),
    crew: payload.crew.slice(0, 8),
    recommendations: payload.recommendations.map((item) => ({
      ...item,
      mediaType: item.mediaType === "tv" ? "tv" : "movie",
    })),
    watchProviders: payload.watchProviders,
  };
}
