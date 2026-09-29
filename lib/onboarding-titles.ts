import "server-only";

import { createHash } from "node:crypto";
import { DEMO_TITLES } from "@/lib/demo-seed";
import {
  getNowPlaying,
  getPopularMovies,
  getPopularTv,
  getTrending,
  type TmdbSearchResult,
} from "@/lib/tmdb";

export interface OnboardingTitle {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  overview: string;
  posterPath: string;
  backdropPath: string;
  releaseDate: string | null;
  genres: string[];
}

const TITLE_COUNT = 10;

const MOVIE_GENRES = new Map<number, string>([
  [28, "Action"],
  [12, "Adventure"],
  [16, "Animation"],
  [35, "Comedy"],
  [80, "Crime"],
  [99, "Documentary"],
  [18, "Drama"],
  [10751, "Family"],
  [14, "Fantasy"],
  [36, "History"],
  [27, "Horror"],
  [10402, "Music"],
  [9648, "Mystery"],
  [10749, "Romance"],
  [878, "Science Fiction"],
  [53, "Thriller"],
  [10752, "War"],
  [37, "Western"],
]);

const TV_GENRES = new Map<number, string>([
  [10759, "Action & Adventure"],
  [16, "Animation"],
  [35, "Comedy"],
  [80, "Crime"],
  [99, "Documentary"],
  [18, "Drama"],
  [10751, "Family"],
  [10762, "Kids"],
  [9648, "Mystery"],
  [10764, "Reality"],
  [10765, "Sci-Fi & Fantasy"],
  [10766, "Soap"],
  [10767, "Talk"],
  [10768, "War & Politics"],
  [37, "Western"],
]);

/**
 * Build a small current-catalogue taste deck. TMDB calls already use the
 * shared data cache, so a new account does not create a fresh upstream bill.
 * The account id only determines order; it is never sent to TMDB.
 */
export async function getOnboardingTitles(accountId: string) {
  const [trending, nowPlaying, popularMovies, popularTv] = await Promise.all([
    getTrending(),
    getNowPlaying(),
    getPopularMovies(),
    getPopularTv(),
  ]);

  const seen = new Set<string>();
  const pool = [trending, nowPlaying, popularMovies, popularTv]
    .flat()
    .flatMap((item) => {
      const normalized = normalizeTitle(item);
      if (!normalized) return [];
      const key = `${normalized.mediaType}:${normalized.tmdbId}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [normalized];
    });

  const candidates = pool.length >= TITLE_COUNT ? pool : fallbackTitles();
  const random = seededRandom(`${accountId}:taste-deck:v1`);
  const movies = shuffle(
    candidates.filter((item) => item.mediaType === "movie"),
    random,
  );
  const series = shuffle(
    candidates.filter((item) => item.mediaType === "tv"),
    random,
  );

  const balanced: OnboardingTitle[] = [];
  while (balanced.length < TITLE_COUNT && (movies.length || series.length)) {
    const preferred = balanced.length % 2 === 0 ? movies : series;
    const alternate = preferred === movies ? series : movies;
    const next = preferred.shift() ?? alternate.shift();
    if (next) balanced.push(next);
  }

  return balanced;
}

function normalizeTitle(item: TmdbSearchResult): OnboardingTitle | null {
  if (item.media_type !== "movie" && item.media_type !== "tv") return null;
  const title = item.title || item.name;
  const overview = item.overview?.trim();
  if (!title || !overview || overview.length < 40) return null;
  if (!item.poster_path || !item.backdrop_path) return null;

  const genreMap = item.media_type === "movie" ? MOVIE_GENRES : TV_GENRES;
  return {
    tmdbId: item.id,
    mediaType: item.media_type,
    title,
    overview,
    posterPath: item.poster_path,
    backdropPath: item.backdrop_path,
    releaseDate: item.release_date || item.first_air_date || null,
    genres: (item.genre_ids ?? [])
      .map((id) => genreMap.get(id))
      .filter((genre): genre is string => Boolean(genre))
      .slice(0, 2),
  };
}

function fallbackTitles(): OnboardingTitle[] {
  return DEMO_TITLES.filter(
    (item) => item.poster_path && item.backdrop_path && item.overview,
  )
    .slice(0, 16)
    .map((item) => ({
      tmdbId: item.tmdb_id,
      mediaType: item.media_type,
      title: item.title,
      overview: item.overview ?? "",
      posterPath: item.poster_path ?? "",
      backdropPath: item.backdrop_path ?? "",
      releaseDate: item.release_date,
      genres: (item.genres ?? []).map((genre) => genre.name).slice(0, 2),
    }));
}

function seededRandom(seed: string) {
  let state = createHash("sha256").update(seed).digest().readUInt32LE(0) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4_294_967_296;
  };
}

function shuffle<T>(items: T[], random: () => number) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}
