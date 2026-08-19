import "server-only";
import { cache } from "react";
import { type TitleRow } from "@/lib/supabase";
import { getLibraryClient } from "@/lib/library-db";

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

  // Explicit force-cache (not just revalidate) so TMDB responses are served
  // from the Data Cache even on dynamically-rendered routes and after
  // request-time APIs (cookies/params) are touched. NOTE: a page that sets
  // `export const dynamic = "force-dynamic"` overrides this back to no-store
  // and re-fetches every request — keep TMDB-fetching pages off force-dynamic.
  const res = await fetch(url, {
    cache: "force-cache",
    next: { revalidate: 60 * 60 },
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

/**
 * Personalised "You might like" pool. Picks the user's top watched titles
 * (by sentiment rating, then TMDB score) as seeds, fans out to TMDB's
 * /recommendations for each, merges by co-occurrence so titles surfaced
 * by multiple seeds rank higher, and strips anything already saved.
 */
export async function getRecommendedFromWatched(): Promise<TmdbSearchResult[]> {
  try {
    const db = await getLibraryClient();
    const [{ data: watched }, { data: saved }] = await Promise.all([
      db
        .from("titles")
        .select("tmdb_id, media_type, rating, tmdb_rating")
        .eq("status", "watched"),
      db.from("titles").select("tmdb_id"),
    ]);

    const seeds = (watched ?? []) as Pick<
      TitleRow,
      "tmdb_id" | "media_type" | "rating" | "tmdb_rating"
    >[];
    if (seeds.length === 0) return [];

    const savedIds = new Set<number>(
      ((saved ?? []) as { tmdb_id: number }[]).map((r) => r.tmdb_id)
    );

    // Rank seeds: user sentiment first (higher = loved), then TMDB score.
    const topSeeds = seeds
      .slice()
      .sort((a, b) => {
        const ra = a.rating != null ? Number(a.rating) : -999;
        const rb = b.rating != null ? Number(b.rating) : -999;
        if (rb !== ra) return rb - ra;
        const ta = a.tmdb_rating != null ? Number(a.tmdb_rating) : 0;
        const tb = b.tmdb_rating != null ? Number(b.tmdb_rating) : 0;
        return tb - ta;
      })
      .slice(0, 8);

    const seedIds = new Set<number>(topSeeds.map((s) => s.tmdb_id));

    const fetched = await Promise.all(
      topSeeds.map((s) =>
        tmdb<{ results: TmdbSearchResult[] }>(
          `/${s.media_type}/${s.tmdb_id}/recommendations`,
          { language: "en-US", page: "1" }
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
    const pool = new Map<number, { item: TmdbSearchResult; hits: number }>();
    for (const list of fetched) {
      for (const item of list) {
        if (item.media_type !== "movie" && item.media_type !== "tv") continue;
        if (savedIds.has(item.id) || seedIds.has(item.id)) continue;
        const prev = pool.get(item.id);
        if (prev) prev.hits += 1;
        else pool.set(item.id, { item, hits: 1 });
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
