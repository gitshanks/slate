import "server-only";
import { cache } from "react";

export { posterUrl, backdropUrl, TMDB_IMG } from "@/lib/tmdb-image";

const TMDB_BASE = "https://api.themoviedb.org/3";
const KEY = process.env.TMDB_API_KEY;

async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  if (!KEY) {
    throw new Error("TMDB_API_KEY is not set. Add it to .env.local.");
  }
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, { next: { revalidate: 60 * 60 } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`TMDB ${res.status} ${path}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Types ──────────────────────────────────────────────────────────

export interface TmdbSearchResult {
  id: number;
  media_type: "movie" | "tv" | "person";
  title?: string;          // movie
  name?: string;           // tv
  original_title?: string;
  original_name?: string;
  overview?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;   // movie
  first_air_date?: string; // tv
  vote_average?: number;
}

export interface TmdbMovieDetail {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  runtime: number | null;
  genres: { id: number; name: string }[];
  vote_average: number;
  vote_count: number;
  tagline: string | null;
}

export interface TmdbTvDetail {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  episode_run_time: number[];
  number_of_seasons: number;
  number_of_episodes: number;
  genres: { id: number; name: string }[];
  vote_average: number;
  vote_count: number;
  tagline: string | null;
}

// ─── API ────────────────────────────────────────────────────────────

export async function searchMulti(query: string) {
  if (!query.trim()) return { results: [] as TmdbSearchResult[] };
  return tmdb<{ results: TmdbSearchResult[] }>("/search/multi", {
    query,
    include_adult: "false",
    language: "en-US",
    page: "1",
  });
}

export async function getMovie(id: number) {
  return tmdb<TmdbMovieDetail>(`/movie/${id}`, { language: "en-US" });
}

export async function getTv(id: number) {
  return tmdb<TmdbTvDetail>(`/tv/${id}`, { language: "en-US" });
}

export interface TmdbReview {
  id: string;
  author: string;
  author_details?: { rating: number | null; avatar_path: string | null };
  content: string;
  created_at: string;
  url: string;
}

export interface TmdbCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface TmdbCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
}

export interface TmdbProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

export interface TmdbWatchProviders {
  /** Flatrate (streaming) providers available in the region. */
  providers: TmdbProvider[];
  /** JustWatch-powered TMDB page for this title — link all logos here. */
  link: string;
}

export interface TmdbDetailWithMeta {
  vote_average: number | null;
  vote_count: number | null;
  tagline: string | null;
  reviews: TmdbReview[];
  trailerKey: string | null;
  recommendations: TmdbSearchResult[];
  cast: TmdbCastMember[];
  /** Directors for movies, creators for TV — ready-formatted names. */
  directedBy: string[];
  /** Streaming availability (flatrate only, US region). Null if unavailable. */
  watchProviders: TmdbWatchProviders | null;
}

export interface TmdbPersonDetail {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
  known_for_department: string;
}

export interface TmdbCombinedCredit {
  id: number;
  media_type: "movie" | "tv";
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  popularity: number;
  character?: string;
}

export interface TmdbVideo {
  key: string;
  site: string;
  type: string;
  official: boolean;
  name: string;
}

/**
 * Fetch TMDB rating + reviews + trailer + recommendations + watch providers for
 * an existing title. Wrapped with React cache() so multiple async server
 * components on the same page share one fetch — no duplicate requests.
 */
export const getTitleMeta = cache(async (
  type: "movie" | "tv",
  tmdbId: number
): Promise<TmdbDetailWithMeta> => {
  try {
    // Fire everything in parallel — no waterfalls
    const [detail, reviews, videos, recs, credits, watchData] = await Promise.all([
      type === "movie" ? getMovie(tmdbId) : getTv(tmdbId),
      tmdb<{ results: TmdbReview[] }>(`/${type}/${tmdbId}/reviews`, {
        language: "en-US",
        page: "1",
      }),
      tmdb<{ results: TmdbVideo[] }>(`/${type}/${tmdbId}/videos`, {
        language: "en-US",
      }).catch(() => ({ results: [] as TmdbVideo[] })),
      tmdb<{ results: TmdbSearchResult[] }>(
        `/${type}/${tmdbId}/recommendations`,
        { language: "en-US", page: "1" }
      ).catch(() => ({ results: [] as TmdbSearchResult[] })),
      tmdb<{ cast: TmdbCastMember[]; crew: TmdbCrewMember[] }>(
        `/${type}/${tmdbId}/credits`,
        { language: "en-US" }
      ).catch(() => ({
        cast: [] as TmdbCastMember[],
        crew: [] as TmdbCrewMember[],
      })),
      tmdb<{ results: Record<string, { flatrate?: TmdbProvider[]; link: string }> }>(
        `/${type}/${tmdbId}/watch/providers`
      ).catch(() => null),
    ]);

    // Pick the best trailer: prefer official YouTube trailers
    const trailer =
      videos.results.find(
        (v) => v.site === "YouTube" && v.type === "Trailer" && v.official
      ) ??
      videos.results.find((v) => v.site === "YouTube" && v.type === "Trailer") ??
      videos.results.find((v) => v.site === "YouTube" && v.type === "Teaser") ??
      null;

    // Recommendations from /{type}/{id}/recommendations already carry media_type,
    // but occasionally don't — default to the parent type.
    const recommendations = recs.results.slice(0, 12).map((r) => ({
      ...r,
      media_type: (r.media_type ?? type) as TmdbSearchResult["media_type"],
    }));

    // Top 15 billed cast, keeping order.
    const cast = (credits.cast ?? [])
      .slice()
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
      .slice(0, 15);

    // Directors for films, creators for series (from detail.created_by if present).
    let directedBy: string[] = [];
    if (type === "movie") {
      directedBy = (credits.crew ?? [])
        .filter((c) => c.job === "Director")
        .map((c) => c.name);
    } else {
      const createdBy = (detail as TmdbTvDetail & {
        created_by?: { name: string }[];
      }).created_by;
      directedBy = (createdBy ?? []).map((c) => c.name);
    }

    const usProviders = watchData?.results?.["US"] ?? null;
    const watchProviders: TmdbWatchProviders | null =
      usProviders && usProviders.flatrate?.length
        ? { providers: usProviders.flatrate, link: usProviders.link }
        : null;

    return {
      vote_average: detail.vote_average ?? null,
      vote_count: detail.vote_count ?? null,
      tagline: detail.tagline ?? null,
      reviews: reviews.results.slice(0, 10),
      trailerKey: trailer?.key ?? null,
      recommendations,
      cast,
      directedBy,
      watchProviders,
    };
  } catch {
    return {
      vote_average: null,
      vote_count: null,
      tagline: null,
      reviews: [],
      trailerKey: null,
      recommendations: [],
      cast: [],
      directedBy: [],
      watchProviders: null,
    };
  }
});

// ─── Discovery / catalogues ───────────────────────────────────────

/** Trending titles across movies + tv for the past week (pages 1+2). */
export async function getTrending(): Promise<TmdbSearchResult[]> {
  try {
    const [p1, p2] = await Promise.all([
      tmdb<{ results: TmdbSearchResult[] }>("/trending/all/week", {
        language: "en-US",
        page: "1",
      }),
      tmdb<{ results: TmdbSearchResult[] }>("/trending/all/week", {
        language: "en-US",
        page: "2",
      }).catch(() => ({ results: [] as TmdbSearchResult[] })),
    ]);
    return [...p1.results, ...p2.results].filter(
      (r) => r.media_type === "movie" || r.media_type === "tv"
    );
  } catch {
    return [];
  }
}

/** Popular films right now (pages 1+2). */
export async function getPopularMovies(): Promise<TmdbSearchResult[]> {
  try {
    const [p1, p2] = await Promise.all([
      tmdb<{ results: TmdbSearchResult[] }>("/movie/popular", {
        language: "en-US",
        page: "1",
      }),
      tmdb<{ results: TmdbSearchResult[] }>("/movie/popular", {
        language: "en-US",
        page: "2",
      }).catch(() => ({ results: [] as TmdbSearchResult[] })),
    ]);
    return [...p1.results, ...p2.results].map((r) => ({
      ...r,
      media_type: "movie" as const,
    }));
  } catch {
    return [];
  }
}

/** Now playing in theaters (pages 1+2). */
export async function getNowPlaying(): Promise<TmdbSearchResult[]> {
  try {
    const [p1, p2] = await Promise.all([
      tmdb<{ results: TmdbSearchResult[] }>("/movie/now_playing", {
        language: "en-US",
        page: "1",
      }),
      tmdb<{ results: TmdbSearchResult[] }>("/movie/now_playing", {
        language: "en-US",
        page: "2",
      }).catch(() => ({ results: [] as TmdbSearchResult[] })),
    ]);
    return [...p1.results, ...p2.results].map((r) => ({
      ...r,
      media_type: "movie" as const,
    }));
  } catch {
    return [];
  }
}

/** Popular TV shows right now (pages 1+2). */
export async function getPopularTv(): Promise<TmdbSearchResult[]> {
  try {
    const [p1, p2] = await Promise.all([
      tmdb<{ results: TmdbSearchResult[] }>("/tv/popular", {
        language: "en-US",
        page: "1",
      }),
      tmdb<{ results: TmdbSearchResult[] }>("/tv/popular", {
        language: "en-US",
        page: "2",
      }).catch(() => ({ results: [] as TmdbSearchResult[] })),
    ]);
    return [...p1.results, ...p2.results].map((r) => ({
      ...r,
      media_type: "tv" as const,
    }));
  } catch {
    return [];
  }
}

// ─── Person ──────────────────────────────────────────────────────

export async function getPersonDetail(id: number): Promise<TmdbPersonDetail> {
  return tmdb<TmdbPersonDetail>(`/person/${id}`, { language: "en-US" });
}

/**
 * Combined credits for a person, sorted by popularity descending.
 * Returns the top 20 unique titles (movie or TV).
 */
export async function getPersonCredits(id: number): Promise<TmdbCombinedCredit[]> {
  const res = await tmdb<{
    cast: TmdbCombinedCredit[];
  }>(`/person/${id}/combined_credits`, { language: "en-US" });

  const seen = new Set<string>();
  return res.cast
    .filter((c) => {
      const key = `${c.media_type}-${c.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return c.media_type === "movie" || c.media_type === "tv";
    })
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, 20);
}

/** Normalise either a movie or TV detail into the shape we store. */
export function normalizeForStorage(
  type: "movie" | "tv",
  detail: TmdbMovieDetail | TmdbTvDetail
) {
  if (type === "movie") {
    const m = detail as TmdbMovieDetail;
    return {
      tmdb_id: m.id,
      media_type: "movie" as const,
      title: m.title,
      original_title: m.original_title,
      overview: m.overview,
      poster_path: m.poster_path,
      backdrop_path: m.backdrop_path,
      release_date: m.release_date || null,
      runtime: m.runtime ?? null,
      genres: m.genres ?? [],
      tmdb_rating: m.vote_average ?? null,
      tmdb_vote_count: m.vote_count ?? null,
    };
  }
  const t = detail as TmdbTvDetail;
  return {
    tmdb_id: t.id,
    media_type: "tv" as const,
    title: t.name,
    original_title: t.original_name,
    overview: t.overview,
    poster_path: t.poster_path,
    backdrop_path: t.backdrop_path,
    release_date: t.first_air_date || null,
    runtime: t.episode_run_time?.[0] ?? null,
    genres: t.genres ?? [],
    tmdb_rating: t.vote_average ?? null,
    tmdb_vote_count: t.vote_count ?? null,
  };
}
