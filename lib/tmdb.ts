import "server-only";

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

export interface TmdbDetailWithMeta {
  vote_average: number | null;
  vote_count: number | null;
  tagline: string | null;
  reviews: TmdbReview[];
}

/**
 * Fetch TMDB rating + reviews for an existing title. Used on the detail page.
 * Cached for an hour by next.
 */
export async function getTitleMeta(
  type: "movie" | "tv",
  tmdbId: number
): Promise<TmdbDetailWithMeta> {
  try {
    const [detail, reviews] = await Promise.all([
      type === "movie" ? getMovie(tmdbId) : getTv(tmdbId),
      tmdb<{ results: TmdbReview[] }>(`/${type}/${tmdbId}/reviews`, {
        language: "en-US",
        page: "1",
      }),
    ]);
    return {
      vote_average: detail.vote_average ?? null,
      vote_count: detail.vote_count ?? null,
      tagline: detail.tagline ?? null,
      reviews: reviews.results.slice(0, 5),
    };
  } catch {
    return { vote_average: null, vote_count: null, tagline: null, reviews: [] };
  }
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
  };
}
