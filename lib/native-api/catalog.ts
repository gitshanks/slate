import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { libraryClientForOwner } from "@/lib/library-db";
import { titleDTO } from "@/lib/native-api/dto";
import { NativeApiError } from "@/lib/native-api/http";
import { getOmdbMetadata, isOmdbConfigured } from "@/lib/omdb";
import { buildPersonProfileDetail } from "@/lib/person-detail";
import {
  getMovie,
  getTitleMeta,
  getTv,
  normalizeForStorage,
  searchAll,
  type TmdbMovieDetail,
  type TmdbSearchResult,
  type TmdbTvDetail,
} from "@/lib/tmdb";
import type { TitleRow, TitleStatus } from "@/lib/types";

const STATUSES = new Set<TitleStatus>(["want", "watching", "watched"]);

export function catalogueResultDTO(item: TmdbSearchResult) {
  const mediaType = item.media_type === "tv" ? "tv" : "movie";
  return {
    tmdbId: item.id,
    mediaType,
    title: item.title || item.name || "Untitled",
    originalTitle: item.original_title || item.original_name || null,
    overview: item.overview || null,
    posterPath: item.poster_path ?? null,
    backdropPath: item.backdrop_path ?? null,
    releaseDate: item.release_date || item.first_air_date || null,
    tmdbRating: item.vote_average ?? null,
  };
}

function personResultDTO(item: TmdbSearchResult) {
  return {
    id: item.id,
    name: item.name || "Unknown",
    profilePath: item.profile_path ?? null,
    knownForDepartment: item.known_for_department ?? null,
    knownFor: (item.known_for ?? []).slice(0, 3).map((known) =>
      known.title || known.name || "Untitled"
    ),
  };
}

export async function searchNativeCatalogue(ownerId: string, query: string) {
  const search = await searchAll(query);
  const db = libraryClientForOwner(ownerId);
  const { data, error } = await db
    .from("titles")
    .select("id, tmdb_id, media_type, status");
  if (error) throw new Error(error.message);
  const saved = new Map(
    (data ?? []).map((row) => [
      `${Number(row.tmdb_id)}:${String(row.media_type)}`,
      { id: String(row.id), status: String(row.status) },
    ]),
  );
  return {
    results: search.media.slice(0, 24).map((item) => ({
      ...catalogueResultDTO(item),
      saved: saved.get(`${item.id}:${item.media_type}`) ?? null,
    })),
    people: search.people.slice(0, 12).map(personResultDTO),
    approximate: search.approximate,
    approximateQuery: search.approxQuery,
  };
}

async function nextStatusPosition(
  db: SupabaseClient,
  status: TitleStatus,
): Promise<number> {
  const { data, error } = await db
    .from("titles")
    .select("position")
    .eq("status", status)
    .order("position", { ascending: true })
    .limit(1);
  if (error) throw new Error(error.message);
  const current = Number(data?.[0]?.position);
  return Number.isFinite(current) ? current - 1 : 0;
}

export async function addNativeTitle(
  ownerId: string,
  input: { tmdbId: number; mediaType: "movie" | "tv"; status: TitleStatus },
) {
  if (!Number.isInteger(input.tmdbId) || input.tmdbId <= 0) {
    throw new NativeApiError(400, "bad_request", "Title id is invalid.");
  }
  if (!STATUSES.has(input.status)) {
    throw new NativeApiError(400, "bad_request", "Status is invalid.");
  }

  const db = libraryClientForOwner(ownerId);
  const { data: existing, error: existingError } = await db
    .from("titles")
    .select("*")
    .eq("tmdb_id", input.tmdbId)
    .eq("media_type", input.mediaType)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return titleDTO(existing as TitleRow);

  const detail = input.mediaType === "movie"
    ? await getMovie(input.tmdbId)
    : await getTv(input.tmdbId);
  const normalized = normalizeForStorage(input.mediaType, detail);
  const omdb = normalized.imdb_id
    ? await getOmdbMetadata(normalized.imdb_id)
    : {
        imdb_rating: null,
        imdb_votes: null,
        rt_score: null,
        metacritic_score: null,
        omdb_plot: null,
      };
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("titles")
    .insert({
      ...normalized,
      ...omdb,
      omdb_plot_fetched_at:
        normalized.imdb_id && isOmdbConfigured() ? now : null,
      ratings_fetched_at:
        omdb.imdb_rating != null || omdb.rt_score != null || omdb.metacritic_score != null
          ? now
          : null,
      status: input.status,
      watched_at: input.status === "watched" ? now : null,
      position: await nextStatusPosition(db, input.status),
    })
    .select("*")
    .single();
  if (error || !data) {
    if (error?.message.toLowerCase().includes("duplicate")) {
      const { data: raced } = await db
        .from("titles")
        .select("*")
        .eq("tmdb_id", input.tmdbId)
        .eq("media_type", input.mediaType)
        .single();
      if (raced) return titleDTO(raced as TitleRow);
    }
    throw new Error(error?.message || "Title could not be added.");
  }
  return titleDTO(data as TitleRow);
}

function detailIdentity(
  mediaType: "movie" | "tv",
  detail: TmdbMovieDetail | TmdbTvDetail,
) {
  const movie = mediaType === "movie" ? detail as TmdbMovieDetail : null;
  const tv = mediaType === "tv" ? detail as TmdbTvDetail : null;
  return {
    tmdbId: detail.id,
    mediaType,
    title: movie?.title ?? tv?.name ?? "Untitled",
    originalTitle: movie?.original_title ?? tv?.original_name ?? null,
    overview: detail.overview || null,
    posterPath: detail.poster_path,
    backdropPath: detail.backdrop_path,
    releaseDate: movie?.release_date ?? tv?.first_air_date ?? null,
    runtime: movie?.runtime ?? tv?.episode_run_time?.[0] ?? null,
    genres: detail.genres ?? [],
    tmdbRating: detail.vote_average ?? null,
    imdbId: detail.imdb_id ?? null,
  };
}

export async function getNativeDiscoverDetail(
  ownerId: string,
  mediaType: "movie" | "tv",
  tmdbId: number,
) {
  const [detail, meta] = await Promise.all([
    mediaType === "movie" ? getMovie(tmdbId) : getTv(tmdbId),
    getTitleMeta(mediaType, tmdbId),
  ]);
  const identity = detailIdentity(mediaType, detail);
  const [omdb, existingResult] = await Promise.all([
    identity.imdbId
      ? getOmdbMetadata(identity.imdbId)
      : Promise.resolve({
          imdb_rating: null,
          imdb_votes: null,
          rt_score: null,
          metacritic_score: null,
          omdb_plot: null,
        }),
    libraryClientForOwner(ownerId)
      .from("titles")
      .select("*")
      .eq("tmdb_id", tmdbId)
      .eq("media_type", mediaType)
      .maybeSingle(),
  ]);
  if (existingResult.error) throw new Error(existingResult.error.message);
  return {
    title: {
      ...identity,
      overview: omdb.omdb_plot || identity.overview,
      imdbRating: omdb.imdb_rating,
      rottenTomatoesScore: omdb.rt_score,
      metacriticScore: omdb.metacritic_score,
    },
    savedTitle: existingResult.data
      ? titleDTO(existingResult.data as TitleRow)
      : null,
    tagline: meta.tagline,
    directedBy: meta.directedBy,
    trailerKey: meta.trailerKey,
    cast: meta.cast.map((person) => ({
      id: person.id,
      name: person.name,
      subtitle: person.character || null,
      profilePath: person.profile_path,
    })),
    crew: meta.crew.map((person) => ({
      id: person.id,
      name: person.name,
      subtitle: person.job || null,
      profilePath: person.profile_path,
    })),
    recommendations: meta.recommendations.map((item) => catalogueResultDTO({
      ...item,
      media_type:
        item.media_type === "movie" || item.media_type === "tv"
          ? item.media_type
          : mediaType,
    })),
    watchProviders: meta.watchProviders
      ? {
          link: meta.watchProviders.link,
          providers: meta.watchProviders.providers.map((provider) => ({
            id: provider.provider_id,
            name: provider.provider_name,
            logoPath: provider.logo_path,
          })),
        }
      : null,
  };
}

export async function getNativePerson(id: number) {
  return buildPersonProfileDetail(id);
}
