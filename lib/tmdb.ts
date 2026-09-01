import "server-only";
import { cache } from "react";
import { type TitleRow } from "@/lib/supabase";
import { getLibraryClient } from "@/lib/library-db";

export { posterUrl, backdropUrl, TMDB_IMG } from "@/lib/tmdb-image";

const TMDB_BASE = "https://api.themoviedb.org/3";
const KEY = process.env.TMDB_API_KEY;

const TMDB_CACHE_SECONDS = {
  default: 60 * 60,
  trending: 6 * 60 * 60,
  nowPlaying: 12 * 60 * 60,
  recommendations: 24 * 60 * 60,
  // Successful and empty `/videos` payloads share one fetch-cache policy. A
  // one-day TTL avoids pinning a newly released trailer as "missing" all week.
  videos: 24 * 60 * 60,
} as const;

async function tmdb<T>(
  path: string,
  params: Record<string, string> = {},
  options: { revalidate?: number } = {},
): Promise<T> {
  if (!KEY) {
    throw new Error("TMDB_API_KEY is not set. Add it to .env.local.");
  }
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  // Explicit force-cache (not just revalidate) so TMDB responses are served
  // from the Data Cache even on dynamically-rendered routes and after
  // request-time APIs (cookies/params) are touched. NOTE: a page that sets
  // `export const dynamic = "force-dynamic"` overrides this back to no-store
  // and re-fetches every request — keep TMDB-fetching pages off force-dynamic.
  const res = await fetch(url, {
    cache: "force-cache",
    next: { revalidate: options.revalidate ?? TMDB_CACHE_SECONDS.default },
  });
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
  vote_count?: number;
  popularity?: number;
  genre_ids?: number[];
  // person results (media_type === "person")
  profile_path?: string | null;
  known_for_department?: string;
  known_for?: {
    id: number;
    title?: string;
    name?: string;
    media_type?: string;
    genre_ids?: number[];
  }[];
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
  imdb_id: string | null;
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
  imdb_id: string | null;
  // TMDB returns one entry per season including the special "Season 0" specials
  // bucket — caller filters as needed.
  seasons: { season_number: number; episode_count: number; name: string }[];
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

/**
 * TMDB `/discover/{movie|tv}` with a free-text params bag. Used by the AI
 * search route to convert a parsed intent (genres, year range, sort) into
 * discoverable results — separate from `/search/multi`, which is keyword-only.
 */
export async function discover(
  type: "movie" | "tv",
  params: Record<string, string>,
): Promise<TmdbMediaResult[]> {
  try {
    const merged = {
      include_adult: "false",
      language: "en-US",
      page: "1",
      ...params,
    };
    const res = await tmdb<{ results: TmdbSearchResult[] }>(
      `/discover/${type}`,
      merged,
    );
    return res.results.map((r) => ({
      ...r,
      media_type: type,
    })) as TmdbMediaResult[];
  } catch {
    return [];
  }
}

/**
 * `searchMulti` with a word-drop fuzzy retry. If the initial query returns
 * zero movie/tv hits, progressively drops trailing words (up to 2 times) and
 * retries. This is the fallback both `/api/tmdb/search` and the import
 * pipeline use so a user's typo (`"Brakeng Bad"` → drop nothing helps,
 * `"The Shawshank"` → drops `"Shawshank"` isn't useful either, but
 * `"Breaking Bad (2008)"` → drops `"(2008)"` recovers).
 */
export async function searchMultiWithFallback(query: string): Promise<{
  results: TmdbMediaResult[];
  approximate: boolean;
  approxQuery: string | null;
}> {
  const trimmed = query.trim();
  if (!trimmed) return { results: [], approximate: false, approxQuery: null };

  const first = await searchMulti(trimmed);
  const results = filterMediaResults(first.results);
  if (results.length > 0) return { results, approximate: false, approxQuery: null };

  const words = trimmed.split(/\s+/);
  for (let drop = 1; drop <= 2 && words.length - drop >= 1; drop++) {
    const retryQuery = words.slice(0, words.length - drop).join(" ");
    if (!retryQuery) break;
    const retry = await searchMulti(retryQuery);
    const retryResults = filterMediaResults(retry.results);
    if (retryResults.length > 0) {
      return { results: retryResults, approximate: true, approxQuery: retryQuery };
    }
  }
  return { results: [], approximate: false, approxQuery: null };
}

/** TMDB `multi` search includes `person` results; narrow to movie|tv. */
export type TmdbMediaResult = TmdbSearchResult & { media_type: "movie" | "tv" };

/** The `person` slice of a `multi` search. */
export type TmdbPersonResult = TmdbSearchResult & { media_type: "person" };

function filterMediaResults(results: TmdbSearchResult[]): TmdbMediaResult[] {
  return results.filter(
    (r): r is TmdbMediaResult => r.media_type === "movie" || r.media_type === "tv"
  );
}

function filterPeopleResults(results: TmdbSearchResult[]): TmdbPersonResult[] {
  return results.filter(
    (r): r is TmdbPersonResult => r.media_type === "person"
  );
}

/**
 * Full `multi` search that keeps both movie/TV titles and people. One
 * `searchMulti` call feeds both buckets; if the exact query yields nothing we
 * reuse the same word-drop fuzzy retry so a trailing typo still surfaces
 * results.
 */
export async function searchAll(query: string): Promise<{
  media: TmdbMediaResult[];
  people: TmdbPersonResult[];
  approximate: boolean;
  approxQuery: string | null;
}> {
  const trimmed = query.trim();
  if (!trimmed) return { media: [], people: [], approximate: false, approxQuery: null };

  const first = await searchMulti(trimmed);
  const media = filterMediaResults(first.results);
  const people = filterPeopleResults(first.results);
  if (media.length > 0 || people.length > 0) {
    return { media, people, approximate: false, approxQuery: null };
  }

  const words = trimmed.split(/\s+/);
  for (let drop = 1; drop <= 2 && words.length - drop >= 1; drop++) {
    const retryQuery = words.slice(0, words.length - drop).join(" ");
    if (!retryQuery) break;
    const retry = await searchMulti(retryQuery);
    const retryMedia = filterMediaResults(retry.results);
    const retryPeople = filterPeopleResults(retry.results);
    if (retryMedia.length > 0 || retryPeople.length > 0) {
      return { media: retryMedia, people: retryPeople, approximate: true, approxQuery: retryQuery };
    }
  }
  return { media: [], people: [], approximate: false, approxQuery: null };
}

export async function getMovie(id: number) {
  return tmdb<TmdbMovieDetail>(`/movie/${id}`, { language: "en-US" });
}

/**
 * TV detail. TMDB doesn't return `imdb_id` on `/tv/{id}` like it does for
 * movies — `append_to_response=external_ids` adds it inline so we don't
 * need a separate request.
 */
export async function getTv(id: number) {
  const raw = await tmdb<
    Omit<TmdbTvDetail, "imdb_id"> & {
      external_ids?: { imdb_id: string | null };
    }
  >(`/tv/${id}`, {
    language: "en-US",
    append_to_response: "external_ids",
  });
  const imdb_id = raw.external_ids?.imdb_id ?? null;
  return { ...raw, imdb_id } as TmdbTvDetail;
}

/** Resolve an IMDb title URL to the corresponding TMDB movie or series. */
export async function findByImdbId(
  imdbId: string,
): Promise<TmdbMediaResult | null> {
  if (!/^tt\d{5,12}$/.test(imdbId)) return null;
  const result = await tmdb<{
    movie_results: TmdbSearchResult[];
    tv_results: TmdbSearchResult[];
  }>(`/find/${imdbId}`, {
    external_source: "imdb_id",
    language: "en-US",
  });

  const movie = result.movie_results?.[0];
  if (movie) return { ...movie, media_type: "movie" } as TmdbMediaResult;
  const tv = result.tv_results?.[0];
  if (tv) return { ...tv, media_type: "tv" } as TmdbMediaResult;
  return null;
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
  /** Combined, comma-joined roles for display (e.g. "Director, Writer"). */
  job: string;
  department: string;
  profile_path: string | null;
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
  trailerKey: string | null;
  recommendations: TmdbSearchResult[];
  cast: TmdbCastMember[];
  /** Key crew (director, writers, producers, DP, composer, editor…). */
  crew: TmdbCrewMember[];
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
  original_title?: string;
  original_name?: string;
  overview?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  popularity: number;
  character?: string;
  genre_ids?: number[];
  department?: string;
  job?: string;
}

export interface TmdbVideo {
  key: string;
  site: string;
  type: string;
  official: boolean;
  name: string;
}

export type TmdbPreviewSource = "library" | "trending" | "now_playing";

/** A playable, serializable item for the portrait-first Previews feed. */
export interface TmdbPreviewItem extends TmdbMediaResult {
  source: TmdbPreviewSource;
  /** True only when the server had to relax the recent-view cooldown. */
  recentlyExposed: boolean;
  videoKey: string;
  videoName: string;
  videoType: string;
  videoOfficial: boolean;
  /** TMDB has no aspect-ratio metadata, so portrait is an explicit-name hint only. */
  orientationHint: "portrait" | "landscape";
}

export interface TmdbPreviewBatch {
  items: TmdbPreviewItem[];
  /** Includes candidates without a playable trailer so they are not retried. */
  attemptedKeys: string[];
}

/**
 * Small, bounded preference deltas learned during the current preview session.
 * Callers should keep every value in [-1, 1]; the ranker clamps again at the
 * boundary so malformed client input cannot dominate relevance.
 */
export interface TmdbPreviewAdaptiveWeights {
  source?: Partial<Record<TmdbPreviewSource, number>>;
  genre?: Record<string, number>;
  mediaType?: Partial<Record<"movie" | "tv", number>>;
}

export interface TmdbPreviewFeedOptions {
  targetSize?: number;
  lookupLimit?: number;
  waveSize?: number;
  /** Stable per browsing session. Supplying it makes ranking reproducible. */
  sessionSeed?: string;
  /** Zero-based continuation batch; rotates the unseen candidate ordering. */
  batchIndex?: number;
  adaptiveWeights?: TmdbPreviewAdaptiveWeights;
  /**
   * Recently viewed titles. They stay eligible, but only after every unseen
   * candidate is exhausted so active viewers never hit a cooldown cliff.
   */
  softExcludedKeys?: ReadonlySet<string>;
}

export interface TmdbRecommendationOptions {
  /** Rotates the strongest taste seeds without increasing provider fan-out. */
  rotationSeed?: string;
  /** Defaults to eight normally and six for the rotating previews path. */
  seedCount?: number;
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
    // One combined request via append_to_response instead of six parallel
    // calls. TMDB returns detail + reviews + videos + recommendations +
    // credits + watch/providers nested in a single response, cutting the
    // per-title TMDB call count 6→1 — the dominant shape of our API spend.
    const data = await tmdb<
      (TmdbMovieDetail | TmdbTvDetail) & {
        created_by?: { name: string }[];
        videos?: { results: TmdbVideo[] };
        recommendations?: { results: TmdbSearchResult[] };
        credits?: { cast: TmdbCastMember[]; crew: TmdbCrewMember[] };
        "watch/providers"?: {
          results: Record<string, { flatrate?: TmdbProvider[]; link: string }>;
        };
      }
    >(`/${type}/${tmdbId}`, {
      language: "en-US",
      append_to_response: "videos,recommendations,credits,watch/providers",
    });

    const detail = data;
    const videos = data.videos ?? { results: [] as TmdbVideo[] };
    const recs = data.recommendations ?? { results: [] as TmdbSearchResult[] };
    const credits = data.credits ?? {
      cast: [] as TmdbCastMember[],
      crew: [] as TmdbCrewMember[],
    };
    const watchData = data["watch/providers"] ?? null;

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

    // Key crew, deduped per person with their roles combined and ordered by
    // importance. Capped so the grid stays tidy like the cast (TMDB crew can
    // run to 100+ entries across every department).
    // Creative roles first; producers last so a film with a dozen exec
    // producers doesn't crowd out the DP, composer, and editor.
    const KEY_CREW_JOBS = [
      "Director",
      "Screenplay", "Writer", "Story", "Novel", "Characters",
      "Director of Photography",
      "Original Music Composer", "Music",
      "Editor",
      "Production Design",
      "Costume Design",
      "Producer", "Executive Producer",
    ];
    const crewByPerson = new Map<
      number,
      { id: number; name: string; profile_path: string | null; jobs: string[]; rank: number }
    >();
    for (const c of credits.crew ?? []) {
      const rank = KEY_CREW_JOBS.indexOf(c.job);
      if (rank === -1) continue;
      const existing = crewByPerson.get(c.id);
      if (existing) {
        if (!existing.jobs.includes(c.job)) existing.jobs.push(c.job);
        existing.rank = Math.min(existing.rank, rank);
      } else {
        crewByPerson.set(c.id, {
          id: c.id,
          name: c.name,
          profile_path: c.profile_path ?? null,
          jobs: [c.job],
          rank,
        });
      }
    }
    const crew: TmdbCrewMember[] = [...crewByPerson.values()]
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 12)
      .map((c) => ({
        id: c.id,
        name: c.name,
        profile_path: c.profile_path,
        department: "",
        job: c.jobs
          .sort((x, y) => KEY_CREW_JOBS.indexOf(x) - KEY_CREW_JOBS.indexOf(y))
          .join(", "),
      }));

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
      trailerKey: trailer?.key ?? null,
      recommendations,
      cast,
      crew,
      directedBy,
      watchProviders,
    };
  } catch {
    return {
      vote_average: null,
      vote_count: null,
      tagline: null,
      trailerKey: null,
      recommendations: [],
      cast: [],
      crew: [],
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
      }, { revalidate: TMDB_CACHE_SECONDS.trending }),
      tmdb<{ results: TmdbSearchResult[] }>("/trending/all/week", {
        language: "en-US",
        page: "2",
      }, { revalidate: TMDB_CACHE_SECONDS.trending }).catch(() => ({
        results: [] as TmdbSearchResult[],
      })),
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
      }, { revalidate: TMDB_CACHE_SECONDS.nowPlaying }),
      tmdb<{ results: TmdbSearchResult[] }>("/movie/now_playing", {
        language: "en-US",
        page: "2",
      }, { revalidate: TMDB_CACHE_SECONDS.nowPlaying }).catch(() => ({
        results: [] as TmdbSearchResult[],
      })),
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

/**
 * "Shows/movies like X" — fetches TMDB's curated recommendations for a
 * specific title. Used by the AI chat's `find_similar` tool when the user
 * asks for similarity ("shows like friends") rather than filter-style
 * discovery ("90s rom-coms").
 */
export async function getRecommendationsFor(
  type: "movie" | "tv",
  tmdbId: number,
): Promise<TmdbMediaResult[]> {
  try {
    const res = await tmdb<{ results: TmdbSearchResult[] }>(
      `/${type}/${tmdbId}/recommendations`,
      { language: "en-US", page: "1" },
      { revalidate: TMDB_CACHE_SECONDS.recommendations },
    );
    return res.results
      .map((r) => ({
        ...r,
        media_type: (r.media_type ?? type) as TmdbSearchResult["media_type"],
      }))
      .filter(
        (r): r is TmdbMediaResult => r.media_type === "movie" || r.media_type === "tv",
      );
  } catch {
    return [];
  }
}

function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/** Stable FNV-1a hash followed by Mulberry32; identical seed, identical deck. */
function createSeededRandom(seed: string): () => number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  let state = hash >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedIndex(weights: number[], random: () => number): number {
  const total = weights.reduce(
    (sum, weight) => sum + (Number.isFinite(weight) ? Math.max(0, weight) : 0),
    0,
  );
  if (total <= 0) return Math.floor(random() * weights.length);

  let cursor = random() * total;
  for (let index = 0; index < weights.length; index += 1) {
    cursor -= Math.max(0, weights[index] ?? 0);
    if (cursor <= 0) return index;
  }
  return weights.length - 1;
}

function rotateRankedSeeds<T>(
  rankedSeeds: T[],
  count: number,
  rotationSeed: string,
): T[] {
  const random = createSeededRandom(rotationSeed);
  const remaining = rankedSeeds.map((seed, rank) => ({ seed, rank }));
  const selected: T[] = [];

  while (remaining.length > 0 && selected.length < count) {
    // Most choices favor the user's strongest signals. A bounded exploration
    // lane rotates through the rest of the high-confidence taste pool so the
    // recommendation fan-out is not permanently anchored to the same titles.
    const exploring = random() < 0.22;
    const weights = remaining.map(({ rank }) =>
      exploring ? 1 : Math.exp(-rank / 4.5),
    );
    const index = weightedIndex(weights, random);
    selected.push(remaining[index].seed);
    remaining.splice(index, 1);
  }
  return selected;
}

/**
 * Personalised "You might like" pool. Picks the user's top watched titles
 * (by sentiment rating, then TMDB score) as seeds, fans out to TMDB's
 * /recommendations for each, merges by co-occurrence so titles surfaced
 * by multiple seeds rank higher, and strips anything already saved.
 */
export async function getRecommendedFromWatched(
  excludedKeys?: ReadonlySet<string>,
  options: TmdbRecommendationOptions = {},
): Promise<TmdbSearchResult[]> {
  try {
    const db = await getLibraryClient();
    const watchedRequest = db
      .from("titles")
      .select("tmdb_id, media_type, rating, favorite, tmdb_rating, watched_at")
      .eq("status", "watched");
    const [{ data: watched }, savedResult] = await Promise.all([
      watchedRequest,
      excludedKeys
        ? Promise.resolve({ data: null })
        : db.from("titles").select("tmdb_id, media_type"),
    ]);

    const seeds = (watched ?? []) as Pick<
      TitleRow,
      | "tmdb_id"
      | "media_type"
      | "rating"
      | "favorite"
      | "tmdb_rating"
      | "watched_at"
    >[];
    if (seeds.length === 0) return [];

    // The preview loader already supplies a server-built exclusion set that
    // includes the current library, so its extra saved-title query is skipped.
    // Discover/AI callers omit it and retain the original self-contained path.
    const savedKeys = excludedKeys
      ? new Set(excludedKeys)
      : new Set<string>(
          ((savedResult.data ?? []) as Pick<
            TitleRow,
            "tmdb_id" | "media_type"
          >[]).map((row) => `${row.media_type}:${row.tmdb_id}`),
        );

    // Prefer explicit positive taste signals. Disliked titles must never seed
    // recommendations; unrated watched titles are only a fallback when the
    // user has not reacted positively to anything yet.
    const positiveSeeds = seeds.filter(
      (seed) => seed.favorite || (seed.rating != null && seed.rating >= 2),
    );
    const usableSeeds = (
      positiveSeeds.length > 0
        ? positiveSeeds
        : seeds.filter((seed) => seed.rating == null || seed.rating >= 2)
    );

    // Rank seeds: user sentiment first (higher = loved), then TMDB score.
    const rankedSeeds = usableSeeds
      .slice()
      .sort((a, b) => {
        if (Number(b.favorite) !== Number(a.favorite)) {
          return Number(b.favorite) - Number(a.favorite);
        }
        const ra = a.rating != null ? Number(a.rating) : -999;
        const rb = b.rating != null ? Number(b.rating) : -999;
        if (rb !== ra) return rb - ra;
        const ta = a.tmdb_rating != null ? Number(a.tmdb_rating) : 0;
        const tb = b.tmdb_rating != null ? Number(b.tmdb_rating) : 0;
        if (tb !== ta) return tb - ta;
        const watchedB = Date.parse(b.watched_at ?? "");
        const watchedA = Date.parse(a.watched_at ?? "");
        const watchedDifference =
          (Number.isFinite(watchedB) ? watchedB : 0) -
          (Number.isFinite(watchedA) ? watchedA : 0);
        if (watchedDifference !== 0) return watchedDifference;

        // PostgreSQL does not guarantee row order when every preference field
        // ties. Keep the daily rotation reproducible so the same taste seed
        // resolves to the same cached TMDB recommendation endpoints.
        const mediaTypeDifference = a.media_type.localeCompare(b.media_type);
        if (mediaTypeDifference !== 0) return mediaTypeDifference;
        return Number(a.tmdb_id) - Number(b.tmdb_id);
      });

    const seedCount = Math.floor(clampNumber(
      options.seedCount ?? (options.rotationSeed ? 6 : 8),
      1,
      8,
    ));
    const topSeeds = options.rotationSeed
      ? rotateRankedSeeds(
          rankedSeeds.slice(0, 24),
          seedCount,
          options.rotationSeed,
        )
      : rankedSeeds.slice(0, seedCount);

    const seedKeys = new Set<string>(
      topSeeds.map((seed) => `${seed.media_type}:${seed.tmdb_id}`),
    );

    const fetched = await Promise.all(
      topSeeds.map((s) =>
        tmdb<{ results: TmdbSearchResult[] }>(
          `/${s.media_type}/${s.tmdb_id}/recommendations`,
          { language: "en-US", page: "1" },
          { revalidate: TMDB_CACHE_SECONDS.recommendations },
        )
          .then((r) =>
            r.results.map((x) => ({
              ...x,
              media_type: (x.media_type ?? s.media_type) as TmdbSearchResult["media_type"],
            }))
          )
          .catch(() => [] as TmdbSearchResult[])
      )
    );

    // Merge by tmdb id, tallying co-occurrence so items recommended by
    // multiple seeds float to the top.
    const pool = new Map<string, { item: TmdbSearchResult; hits: number }>();
    for (const list of fetched) {
      for (const item of list) {
        if (item.media_type !== "movie" && item.media_type !== "tv") continue;
        const key = `${item.media_type}:${item.id}`;
        if (savedKeys.has(key) || seedKeys.has(key)) continue;
        const prev = pool.get(key);
        if (prev) prev.hits += 1;
        else pool.set(key, { item, hits: 1 });
      }
    }

    return Array.from(pool.values())
      .sort((a, b) => {
        if (b.hits !== a.hits) return b.hits - a.hits;
        return (b.item.vote_average ?? 0) - (a.item.vote_average ?? 0);
      })
      .slice(0, 80)
      .map((e) => e.item);
  } catch {
    return [];
  }
}

const PREVIEW_TARGET_SIZE = 24;
const PREVIEW_LOOKUP_LIMIT = 24;
const PREVIEW_WAVE_SIZE = 12;
const PREVIEW_EXPLORE_RATE = 0.22;

const PREVIEW_SOURCE_PRIORITY: readonly TmdbPreviewSource[] = [
  "library",
  "trending",
  "now_playing",
];

const PREVIEW_SOURCE_TARGET: Record<TmdbPreviewSource, number> = {
  library: 0.5,
  trending: 0.3,
  now_playing: 0.2,
};

const PREVIEW_SOURCE_RELEVANCE: Record<TmdbPreviewSource, number> = {
  library: 1,
  trending: 0.82,
  now_playing: 0.76,
};

const PORTRAIT_VIDEO_NAME =
  /\b(?:vertical|portrait|shorts)\b|9\s*(?::|x|×)\s*16/i;

interface TmdbPreviewCandidate {
  item: TmdbMediaResult;
  source: TmdbPreviewSource;
  baseScore: number;
  recentlyExposed: boolean;
}

interface TmdbPreviewPoolEntry {
  item: TmdbMediaResult;
  source: TmdbPreviewSource;
  ranks: Partial<Record<TmdbPreviewSource, number>>;
}

function mediaKey(item: Pick<TmdbMediaResult, "id" | "media_type">): string {
  return `${item.media_type}:${item.id}`;
}

function previewMediaResults(items: TmdbSearchResult[]): TmdbMediaResult[] {
  return items.filter(
    (item): item is TmdbMediaResult =>
      item.media_type === "movie" || item.media_type === "tv",
  );
}

function previewReleaseFreshness(item: TmdbMediaResult): number {
  const rawDate = item.release_date ?? item.first_air_date;
  if (!rawDate) return 0.25;
  const timestamp = Date.parse(rawDate);
  if (!Number.isFinite(timestamp)) return 0.25;
  const ageInYears = (Date.now() - timestamp) / (365.25 * 24 * 60 * 60 * 1000);
  if (ageInYears <= 1) return 1;
  if (ageInYears <= 3) return 0.82;
  if (ageInYears <= 7) return 0.58;
  if (ageInYears <= 15) return 0.36;
  return 0.18;
}

function previewQuality(item: TmdbMediaResult): number {
  const rating = clampNumber((item.vote_average ?? 0) / 10, 0, 1);
  const confidence = clampNumber(
    Math.log1p(Math.max(0, item.vote_count ?? 0)) / Math.log1p(5_000),
    0,
    1,
  );
  return rating * (0.45 + confidence * 0.55);
}

function normalizedAdaptiveValue(value: number | undefined): number {
  return Number.isFinite(value) ? clampNumber(value ?? 0, -1, 1) : 0;
}

function previewAdaptiveScore(
  candidate: TmdbPreviewCandidate,
  adaptiveWeights: TmdbPreviewAdaptiveWeights | undefined,
): number {
  if (!adaptiveWeights) return 0;
  const source = normalizedAdaptiveValue(
    adaptiveWeights.source?.[candidate.source],
  );
  const mediaType = normalizedAdaptiveValue(
    adaptiveWeights.mediaType?.[candidate.item.media_type],
  );
  const genres = candidate.item.genre_ids ?? [];
  const genre = genres.length > 0
    ? genres.reduce(
        (sum, genreId) =>
          sum + normalizedAdaptiveValue(adaptiveWeights.genre?.[String(genreId)]),
        0,
      ) / Math.sqrt(genres.length)
    : 0;
  return source * 0.1 + mediaType * 0.08 + clampNumber(genre, -1, 1) * 0.12;
}

function previewGenreOverlap(
  left: TmdbPreviewCandidate,
  right: TmdbPreviewCandidate,
): number {
  const leftGenres = left.item.genre_ids ?? [];
  const rightGenres = right.item.genre_ids ?? [];
  if (leftGenres.length === 0 || rightGenres.length === 0) return 0;
  const rightSet = new Set(rightGenres);
  const shared = leftGenres.filter((genreId) => rightSet.has(genreId)).length;
  return shared / new Set([...leftGenres, ...rightGenres]).size;
}

function previewDiversityAdjustment(
  candidate: TmdbPreviewCandidate,
  selected: TmdbPreviewCandidate[],
  sourceCounts: Record<TmdbPreviewSource, number>,
  exploring: boolean,
): number {
  if (selected.length === 0) return 0;
  const recent = selected.slice(-5);
  let adjustment = 0;

  // MMR-like similarity penalty: repeated genres matter most for adjacent
  // previews and fade across the last five cards.
  for (let offset = 1; offset <= recent.length; offset += 1) {
    const previous = recent[recent.length - offset];
    adjustment -= previewGenreOverlap(candidate, previous) * (0.13 / offset);
  }

  const last = recent[recent.length - 1];
  if (last.source === candidate.source) adjustment -= 0.09;
  if (
    recent.length >= 2 &&
    recent.slice(-2).every((item) => item.source === candidate.source)
  ) {
    adjustment -= 0.12;
  }

  const mediaStreak = [...recent]
    .reverse()
    .findIndex((item) => item.item.media_type !== candidate.item.media_type);
  const matchingMedia = mediaStreak === -1 ? recent.length : mediaStreak;
  if (matchingMedia >= 1) adjustment -= 0.025;
  if (matchingMedia >= 3) adjustment -= 0.14;

  // Keep 50/30/20 as a soft rolling target, never a visible fixed rhythm.
  const nextLength = selected.length + 1;
  const targetCount = PREVIEW_SOURCE_TARGET[candidate.source] * nextLength;
  const balance = clampNumber(
    (targetCount - sourceCounts[candidate.source]) / Math.max(1, targetCount),
    -1,
    1,
  );
  adjustment += balance * (exploring ? 0.16 : 0.1);

  if (exploring) {
    const recentGenres = new Set(recent.flatMap((item) => item.item.genre_ids ?? []));
    const introducesGenre = (candidate.item.genre_ids ?? []).some(
      (genreId) => !recentGenres.has(genreId),
    );
    if (introducesGenre) adjustment += 0.1;
  }

  return adjustment;
}

function previewCandidates(
  library: TmdbSearchResult[],
  trending: TmdbSearchResult[],
  nowPlaying: TmdbSearchResult[],
  excludedKeys: ReadonlySet<string>,
  lookupLimit: number,
  seed: string,
  adaptiveWeights?: TmdbPreviewAdaptiveWeights,
  softExcludedKeys: ReadonlySet<string> = new Set(),
): TmdbPreviewCandidate[] {
  const rawPools: Record<TmdbPreviewSource, TmdbMediaResult[]> = {
    library: previewMediaResults(library),
    trending: previewMediaResults(trending),
    now_playing: previewMediaResults(nowPlaying),
  };

  // Merge duplicate catalogue entries while retaining every source rank. The
  // strongest source remains the user-facing explanation, but a high position
  // in any pool can improve the candidate's relevance.
  const pool = new Map<string, TmdbPreviewPoolEntry>();
  for (const source of PREVIEW_SOURCE_PRIORITY) {
    rawPools[source].forEach((item, rank) => {
      const key = mediaKey(item);
      if (excludedKeys.has(key)) return;
      const existing = pool.get(key);
      if (existing) {
        existing.ranks[source] = rank;
        return;
      }
      pool.set(key, { item, source, ranks: { [source]: rank } });
    });
  }

  const maximumPopularity = Math.max(
    1,
    ...Array.from(pool.values(), ({ item }) =>
      Math.log1p(Math.max(0, item.popularity ?? 0)),
    ),
  );
  const remaining: TmdbPreviewCandidate[] = Array.from(pool.values()).map(
    ({ item, source, ranks }) => {
      let bestPoolRank = 0;
      for (const candidateSource of PREVIEW_SOURCE_PRIORITY) {
        const rank = ranks[candidateSource];
        if (rank == null) continue;
        const poolSize = Math.max(1, rawPools[candidateSource].length);
        const normalizedRank = 1 - rank / poolSize;
        bestPoolRank = Math.max(
          bestPoolRank,
          normalizedRank * PREVIEW_SOURCE_RELEVANCE[candidateSource],
        );
      }
      const popularity =
        Math.log1p(Math.max(0, item.popularity ?? 0)) / maximumPopularity;
      const baseScore =
        PREVIEW_SOURCE_RELEVANCE[source] * 0.36 +
        bestPoolRank * 0.25 +
        previewQuality(item) * 0.18 +
        popularity * 0.12 +
        previewReleaseFreshness(item) * 0.09;
      return {
        item,
        source,
        baseScore,
        recentlyExposed: softExcludedKeys.has(mediaKey(item)),
      };
    },
  );

  const random = createSeededRandom(seed);
  const sourceCounts: Record<TmdbPreviewSource, number> = {
    library: 0,
    trending: 0,
    now_playing: 0,
  };
  const result: TmdbPreviewCandidate[] = [];

  while (remaining.length > 0 && result.length < lookupLimit) {
    // 78% exploitation keeps the deck relevant. The 22% exploration lane
    // flattens the distribution and emphasizes unseen genres/sources while
    // preserving a quality floor through the same base score.
    const exploring = random() < PREVIEW_EXPLORE_RATE;
    const unseenRemaining = remaining.some(
      (candidate) => !candidate.recentlyExposed,
    );
    const eligibleIndices = remaining.flatMap((candidate, index) =>
      !unseenRemaining || !candidate.recentlyExposed ? [index] : [],
    );
    const scores = eligibleIndices.map((index) => {
      const candidate = remaining[index];
      return (
      candidate.baseScore +
      previewAdaptiveScore(candidate, adaptiveWeights) +
        previewDiversityAdjustment(candidate, result, sourceCounts, exploring)
      );
    });
    const maximumScore = Math.max(...scores);
    const temperature = exploring ? 0.48 : 0.14;
    const weights = scores.map((score) =>
      Math.exp((score - maximumScore) / temperature),
    );
    const selectedIndex = eligibleIndices[weightedIndex(weights, random)];
    const [selected] = remaining.splice(selectedIndex, 1);
    result.push(selected);
    sourceCounts[selected.source] += 1;
  }

  return result;
}

async function previewVideosFor(
  type: "movie" | "tv",
  tmdbId: number,
): Promise<TmdbVideo[]> {
  try {
    const result = await tmdb<{ results: TmdbVideo[] }>(
      `/${type}/${tmdbId}/videos`,
      { language: "en-US" },
      { revalidate: TMDB_CACHE_SECONDS.videos },
    );
    return result.results ?? [];
  } catch {
    return [];
  }
}

function bestPreviewVideo(videos: TmdbVideo[]): TmdbVideo | null {
  const ranked = videos
    .map((video, index) => ({ video, index }))
    .filter(({ video }) => {
      const type = video.type.toLowerCase();
      return (
        video.site.toLowerCase() === "youtube" &&
        Boolean(video.key) &&
        (type === "trailer" || type === "teaser")
      );
    })
    .sort((a, b) => {
      const portraitA = Number(PORTRAIT_VIDEO_NAME.test(a.video.name));
      const portraitB = Number(PORTRAIT_VIDEO_NAME.test(b.video.name));
      if (portraitB !== portraitA) return portraitB - portraitA;

      const typeRank = (video: TmdbVideo): number => {
        const type = video.type.toLowerCase();
        if (type === "trailer" && video.official) return 4;
        if (type === "trailer") return 3;
        if (type === "teaser" && video.official) return 2;
        return 1;
      };
      const rankDifference = typeRank(b.video) - typeRank(a.video);
      return rankDifference || a.index - b.index;
    });

  return ranked[0]?.video ?? null;
}

async function hydratePreviewCandidate(
  candidate: TmdbPreviewCandidate,
): Promise<TmdbPreviewItem | null> {
  const videos = await previewVideosFor(
    candidate.item.media_type,
    candidate.item.id,
  );
  const video = bestPreviewVideo(videos);
  if (!video) return null;

  return {
    ...candidate.item,
    source: candidate.source,
    recentlyExposed: candidate.recentlyExposed,
    videoKey: video.key,
    videoName: video.name,
    videoType: video.type,
    videoOfficial: Boolean(video.official),
    orientationHint: PORTRAIT_VIDEO_NAME.test(video.name)
      ? "portrait"
      : "landscape",
  };
}

/**
 * Build a playable feed for `/previews` from personalised, trending, and
 * theatrical catalogues. Saved titles are removed before video hydration so
 * they cannot consume a slot or leave holes. Candidates are hydrated in
 * bounded waves until the requested number of playable trailers are ready,
 * with an absolute ceiling of 24 cached `/videos` lookups per request. Combined
 * with the source catalogue calls, this remains below TMDB's approximate
 * cold-request ceiling.
 */
export async function getPreviewFeedBatch(
  excludedKeys: ReadonlySet<string> = new Set(),
  options: TmdbPreviewFeedOptions = {},
): Promise<TmdbPreviewBatch> {
  const targetSize = Math.max(
    1,
    Math.min(PREVIEW_TARGET_SIZE, Math.floor(options.targetSize ?? PREVIEW_TARGET_SIZE)),
  );
  const lookupLimit = Math.max(
    targetSize,
    Math.min(
      PREVIEW_LOOKUP_LIMIT,
      Math.floor(options.lookupLimit ?? PREVIEW_LOOKUP_LIMIT),
    ),
  );
  const waveSize = Math.max(
    1,
    Math.min(PREVIEW_WAVE_SIZE, Math.floor(options.waveSize ?? PREVIEW_WAVE_SIZE)),
  );
  const requestedBatchIndex = Number.isFinite(options.batchIndex)
    ? Math.floor(options.batchIndex ?? 0)
    : 0;
  const batchIndex = clampNumber(requestedBatchIndex, 0, 10_000);
  const suppliedSessionSeed = options.sessionSeed?.trim().slice(0, 128);
  const dayBucket = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  const sessionSeed = suppliedSessionSeed ||
    `daily:${dayBucket}`;
  const batchSeed = `${sessionSeed}:batch:${batchIndex}`;
  const [library, trending, nowPlaying] = await Promise.all([
    getRecommendedFromWatched(excludedKeys, {
      // All sessions share six taste endpoints for this UTC day. Taste
      // mutations still change the ranked seed contents, while a stable
      // rotation bounds cold provider/cache misses across endless batches.
      rotationSeed: `preview-taste-day:${dayBucket}`,
      seedCount: 6,
    }),
    getTrending(),
    getNowPlaying(),
  ]);
  const candidates = previewCandidates(
    library,
    trending,
    nowPlaying,
    excludedKeys,
    lookupLimit,
    `${batchSeed}:rank`,
    options.adaptiveWeights,
    options.softExcludedKeys,
  );

  const hydrateWave = async (
    wave: TmdbPreviewCandidate[],
  ): Promise<TmdbPreviewItem[]> => {
    const items = await Promise.all(wave.map(hydratePreviewCandidate));
    return items.filter((item): item is TmdbPreviewItem => item !== null);
  };

  const playable: TmdbPreviewItem[] = [];
  const attemptedKeys: string[] = [];
  const lookupCount = Math.min(candidates.length, lookupLimit);
  for (
    let start = 0;
    start < lookupCount && playable.length < targetSize;
    start += waveSize
  ) {
    const candidatesInWave = candidates.slice(start, start + waveSize);
    attemptedKeys.push(...candidatesInWave.map(({ item }) => mediaKey(item)));
    const hydrated = await hydrateWave(candidatesInWave);
    playable.push(...hydrated);
  }
  return {
    items: playable.slice(0, targetSize),
    attemptedKeys,
  };
}

export async function getPreviewFeed(
  excludedKeys: ReadonlySet<string> = new Set(),
  options: TmdbPreviewFeedOptions = {},
): Promise<TmdbPreviewItem[]> {
  const batch = await getPreviewFeedBatch(excludedKeys, options);
  return batch.items;
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
  const res = await getPersonCombinedCredits(id);
  return rankPersonCredits([
    ...(res.cast ?? []).filter((credit) => !isNoisyActorCredit(credit)),
    ...(res.crew ?? []),
  ]);
}

interface TmdbPersonCombinedCredits {
  cast: TmdbCombinedCredit[];
  crew: TmdbCombinedCredit[];
}

async function getPersonCombinedCredits(
  id: number,
): Promise<TmdbPersonCombinedCredits> {
  return tmdb<TmdbPersonCombinedCredits>(`/person/${id}/combined_credits`, {
    language: "en-US",
  });
}

function rankPersonCredits(
  credits: TmdbCombinedCredit[],
): TmdbCombinedCredit[] {
  const seen = new Set<string>();
  return credits
    .slice()
    .sort((a, b) => personCreditScore(b) - personCreditScore(a))
    .filter((credit) => {
      if (credit.media_type !== "movie" && credit.media_type !== "tv") {
        return false;
      }
      const key = `${credit.media_type}-${credit.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20);
}

function personCreditScore(credit: TmdbCombinedCredit): number {
  // Raw TMDB popularity heavily favors currently-airing talk shows. Audience
  // vote volume is a much better signal for the titles people associate with
  // a cast member, while popularity still breaks ties for newer work.
  const votes = Math.log1p(Math.max(0, credit.vote_count ?? 0)) * 3;
  const popularity = Math.log1p(Math.max(0, credit.popularity ?? 0));
  const rating = Math.max(0, credit.vote_average ?? 0) * 0.15;
  const movieBias = credit.media_type === "movie" ? 0.35 : 0;
  // A named sketch role can be real acting even when TMDB classifies the
  // series as News/Talk (notably SNL). Preserve it, but keep it below the
  // scripted work people normally mean when they search an actor.
  const noisyActingPenalty =
    credit.character != null && isNoisyPersonTvGenre(credit) ? 9 : 0;
  return votes + popularity + rating + movieBias - noisyActingPenalty;
}

function isSelfAppearance(credit: TmdbCombinedCredit): boolean {
  const role = credit.character?.trim() ?? "";
  return (
    /^(self|himself|herself|themself|themselves)\b/i.test(role) ||
    /\barchive footage\b/i.test(role)
  );
}

const NOISY_ACTOR_TV_GENRES = new Set([
  10763, // News
  10764, // Reality
  10767, // Talk
]);

export function isNoisyPersonTvGenre(credit: {
  media_type?: string;
  genre_ids?: number[];
}): boolean {
  return (
    credit.media_type === "tv" &&
    (credit.genre_ids ?? []).some((genreId) =>
      NOISY_ACTOR_TV_GENRES.has(genreId),
    )
  );
}

function isNoisyActorCredit(credit: TmdbCombinedCredit): boolean {
  if (isSelfAppearance(credit)) return true;
  if (!isNoisyPersonTvGenre(credit)) return false;

  // Talk, reality and news credits usually describe the person appearing as
  // themselves. Drop blank/hosting-style roles, but keep named scripted or
  // sketch characters and let the ranking penalty place them appropriately.
  const role = credit.character?.trim() ?? "";
  return (
    !role ||
    /\b(host|presenter|guest|interviewee|contestant|panelist|judge)\b/i.test(
      role,
    )
  );
}

/**
 * Credits that match the person's primary TMDB department. Actor searches
 * stay focused on roles they appeared in; director/writer searches use crew
 * credits instead of mixing in unrelated cameos.
 */
export async function getPersonRelevantCredits(
  id: number,
  knownForDepartment?: string | null,
): Promise<TmdbCombinedCredit[]> {
  const res = await getPersonCombinedCredits(id);
  const department = knownForDepartment?.trim().toLocaleLowerCase();
  const cast = (res.cast ?? []).filter((credit) => !isNoisyActorCredit(credit));
  const departmentCrew = department
    ? (res.crew ?? []).filter(
        (credit) => credit.department?.trim().toLocaleLowerCase() === department,
      )
    : [];
  const relevant =
    department === "acting"
      ? cast
      : department
        ? departmentCrew.length > 0
          ? departmentCrew
          : res.crew ?? []
        : [...cast, ...(res.crew ?? [])];
  return rankPersonCredits(relevant);
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
      imdb_id: m.imdb_id ?? null,
    };
  }
  const t = detail as TmdbTvDetail;
  // Strip TMDB's "Season 0" specials bucket and any zero-episode placeholders
  // so the +1 button doesn't roll into ghost seasons. Keep the regular run
  // numbered season_number → episode_count, in canonical order.
  const seasons = (t.seasons ?? [])
    .filter((s) => s.season_number > 0 && s.episode_count > 0)
    .map((s) => ({ n: s.season_number, c: s.episode_count }))
    .sort((a, b) => a.n - b.n);
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
    imdb_id: t.imdb_id ?? null,
    seasons: seasons.length > 0 ? seasons : null,
  };
}
