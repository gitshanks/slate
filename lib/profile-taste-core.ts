// The numbers on a profile, worked out from a library: pure, client-safe and
// unit-tested in tests/profile-taste.test.mjs. lib/profile-taste.ts reads the
// rows; this file only counts them.

import type { MediaType, TitleRow, TitleStatus } from "./types";

/** At most this many titles make a Top 4. */
export const TOP_TITLES_MAX = 4;

/**
 * An episode with no runtime on TMDB (common for new series) still took time
 * to watch. Counting it as nothing would make a series fan's hours look tiny,
 * so it is counted as a typical drama episode. Films have no such fallback:
 * TMDB almost always has their runtime.
 */
const EPISODE_MINUTES_FALLBACK = 45;

/** A title as a profile shows it: enough for a poster and the title card. */
export interface TastePoster {
  id: string;
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  year: string | null;
  status: TitleStatus;
  rating: number | null;
}

export interface TasteWatching extends TastePoster {
  /** e.g. "Season 2, episode 4 of 10"; null when progress isn't tracked. */
  progressLabel: string | null;
  /** 0 to 1, or null when there is nothing to measure against. */
  progress: number | null;
}

export interface TasteGenre {
  name: string;
  /** Share of every genre tag on watched titles, 0 to 1. */
  share: number;
}

export interface ProfileTaste {
  top: TastePoster[];
  /**
   * True when nobody picked this Top 4: it was pre-picked from the slate
   * (see suggestTop) and is shown but never saved until its owner changes it.
   */
  topSuggested: boolean;
  hours: number;
  hoursThisYear: number;
  counts: { watched: number; watching: number; upNext: number; lists: number };
  /** Every title on the slate except dropped ones. */
  total: number;
  watching: TasteWatching[];
  recent: TastePoster[];
  films: number;
  shows: number;
  genres: TasteGenre[];
  /** Shares of rated watched titles; null until five are rated. */
  ratings: {
    loved: number;
    liked: number;
    disliked: number;
    rated: number;
    verdict: "Generous" | "Balanced" | "Tough";
  } | null;
  year: { year: number; months: number[]; total: number };
  /** "Mostly sci-fi and drama", from the top genres; null on a thin slate. */
  tagline: string | null;
}

/** The parts of a title row the profile reads. */
export type TasteTitleRow = Pick<
  TitleRow,
  | "id"
  | "tmdb_id"
  | "media_type"
  | "title"
  | "poster_path"
  | "backdrop_path"
  | "release_date"
  | "runtime"
  | "genres"
  | "status"
  | "rating"
  | "added_at"
  | "watched_at"
  | "current_season"
  | "current_episode"
  | "seasons"
>;

export interface TasteEpisodeRow {
  title_id: string;
  watched_at: string | null;
}

/** TMDB's genre names, shortened the way people say them. */
const GENRE_NAMES: Record<string, string> = {
  "Science Fiction": "Sci-fi",
  "Sci-Fi & Fantasy": "Sci-fi",
  "Action & Adventure": "Action",
  "War & Politics": "War",
  "TV Movie": "TV film",
};

export function genreName(name: string): string {
  return GENRE_NAMES[name] ?? name;
}

export function tastePoster(row: TasteTitleRow): TastePoster {
  return {
    id: row.id,
    tmdbId: row.tmdb_id,
    mediaType: row.media_type,
    title: row.title,
    posterPath: row.poster_path,
    backdropPath: row.backdrop_path,
    year: row.release_date ? row.release_date.slice(0, 4) : null,
    status: row.status,
    rating: row.rating == null ? null : Number(row.rating),
  };
}

// The same count as totalEpisodes in lib/episode-progress.ts (regular
// seasons only), kept here so this file imports nothing at runtime and its
// test can load it as it is.
function totalEpisodes(seasons: { n: number; c: number }[]): number {
  return seasons.reduce((sum, s) => (s.n >= 1 && s.c > 0 ? sum + s.c : sum), 0);
}

function time(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function episodesBefore(row: TasteTitleRow): number {
  // Without per-episode rows, the show's pointer says how far someone got:
  // every episode of the seasons before it, and the ones before it in its own.
  const seasons = row.seasons ?? [];
  const season = row.current_season ?? 0;
  const episode = row.current_episode ?? 0;
  if (season < 1 || episode < 1) return 0;
  let count = episode - 1;
  for (const s of seasons) if (s.n >= 1 && s.n < season) count += s.c;
  return count;
}

/**
 * Work out every number on a profile. `now` is passed in so the year and
 * "this year" don't depend on the clock in tests.
 */
export function computeProfileTaste({
  titles,
  episodes,
  listCount,
  topIds,
  now = new Date(),
}: {
  titles: TasteTitleRow[];
  episodes: TasteEpisodeRow[];
  listCount: number;
  topIds: string[];
  now?: Date;
}): ProfileTaste {
  const year = now.getUTCFullYear();
  const byId = new Map(titles.map((row) => [row.id, row]));
  const episodesByTitle = new Map<string, TasteEpisodeRow[]>();
  for (const episode of episodes) {
    const list = episodesByTitle.get(episode.title_id);
    if (list) list.push(episode);
    else episodesByTitle.set(episode.title_id, [episode]);
  }

  let minutes = 0;
  let minutesThisYear = 0;
  const counts = { watched: 0, watching: 0, upNext: 0, lists: listCount };
  let films = 0;
  let shows = 0;
  const months = Array.from({ length: 12 }, () => 0);
  const genreTally = new Map<string, number>();
  let genreTags = 0;
  let loved = 0;
  let liked = 0;
  let disliked = 0;

  for (const row of titles) {
    if (row.status === "watched") counts.watched += 1;
    else if (row.status === "watching") counts.watching += 1;
    else if (row.status === "want") counts.upNext += 1;

    // Time spent watching.
    if (row.media_type === "movie") {
      if (row.status === "watched" && row.runtime) {
        minutes += row.runtime;
        if (new Date(time(row.watched_at ?? row.added_at)).getUTCFullYear() === year) {
          minutesThisYear += row.runtime;
        }
      }
    } else {
      const perEpisode = row.runtime || EPISODE_MINUTES_FALLBACK;
      const marked = episodesByTitle.get(row.id) ?? [];
      if (marked.length) {
        minutes += marked.length * perEpisode;
        for (const episode of marked) {
          if (new Date(time(episode.watched_at)).getUTCFullYear() === year) {
            minutesThisYear += perEpisode;
          }
        }
      } else if (row.status === "watched") {
        const count = totalEpisodes(row.seasons ?? []);
        minutes += count * perEpisode;
        if (new Date(time(row.watched_at ?? row.added_at)).getUTCFullYear() === year) {
          minutesThisYear += count * perEpisode;
        }
      } else if (row.status === "watching") {
        minutes += episodesBefore(row) * perEpisode;
      }
    }

    if (row.status !== "watched") continue;

    if (row.media_type === "movie") films += 1;
    else shows += 1;

    const watchedAt = new Date(time(row.watched_at ?? row.added_at));
    if (watchedAt.getUTCFullYear() === year) months[watchedAt.getUTCMonth()] += 1;

    const seen = new Set<string>();
    for (const genre of row.genres ?? []) {
      const name = genreName(genre.name);
      if (seen.has(name)) continue;
      seen.add(name);
      genreTally.set(name, (genreTally.get(name) ?? 0) + 1);
      genreTags += 1;
    }

    const rating = row.rating == null ? null : Number(row.rating);
    if (rating === 3) loved += 1;
    else if (rating === 2) liked += 1;
    else if (rating === 1) disliked += 1;
  }

  const genres = [...genreTally.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([name, count]) => ({ name, share: genreTags ? count / genreTags : 0 }));

  const rated = loved + liked + disliked;
  const ratings =
    rated >= 5
      ? {
          loved: loved / rated,
          liked: liked / rated,
          disliked: disliked / rated,
          rated,
          verdict:
            disliked / rated >= 0.3
              ? ("Tough" as const)
              : loved / rated >= 0.4
                ? ("Generous" as const)
                : ("Balanced" as const),
        }
      : null;

  const watching = titles
    .filter((row) => row.status === "watching")
    .sort((a, b) => time(b.watched_at ?? b.added_at) - time(a.watched_at ?? a.added_at))
    .slice(0, 3)
    .map((row): TasteWatching => {
      const poster = tastePoster(row);
      if (row.media_type !== "tv") {
        return { ...poster, progressLabel: null, progress: null };
      }
      const total = totalEpisodes(row.seasons ?? []);
      const marked = episodesByTitle.get(row.id)?.length ?? 0;
      const done = marked || episodesBefore(row);
      const season = row.current_season ?? null;
      const episode = row.current_episode ?? null;
      const inSeason = season
        ? (row.seasons ?? []).find((s) => s.n === season)?.c ?? null
        : null;
      const progressLabel =
        season && episode
          ? inSeason
            ? `Season ${season}, episode ${episode} of ${inSeason}`
            : `Season ${season}, episode ${episode}`
          : null;
      return {
        ...poster,
        progressLabel,
        progress: total ? Math.min(1, done / total) : null,
      };
    });

  const recent = titles
    .filter((row) => row.status === "watched")
    .sort((a, b) => time(b.watched_at ?? b.added_at) - time(a.watched_at ?? a.added_at))
    .slice(0, 4)
    .map(tastePoster);

  const picked = topIds
    .map((id) => byId.get(id))
    .filter((row): row is TasteTitleRow => Boolean(row) && row!.status !== "dropped")
    .slice(0, TOP_TITLES_MAX);
  const suggested = picked.length ? [] : suggestTop(titles, episodesByTitle);
  const top = (picked.length ? picked : suggested).map(tastePoster);

  const tagline =
    counts.watched >= 5 && genres.length >= 2
      ? `Mostly ${genres[0].name.toLowerCase()} and ${genres[1].name.toLowerCase()}`
      : null;

  return {
    top,
    topSuggested: !picked.length && suggested.length > 0,
    hours: Math.round(minutes / 60),
    hoursThisYear: Math.round(minutesThisYear / 60),
    counts,
    total: titles.filter((row) => row.status !== "dropped").length,
    watching,
    recent,
    films,
    shows,
    genres,
    ratings,
    year: { year, months, total: months.reduce((sum, n) => sum + n, 0) },
    tagline,
  };
}

/** Minutes someone spent on a title: a film's runtime, a show's episodes. */
function minutesOn(row: TasteTitleRow, episodesByTitle: Map<string, TasteEpisodeRow[]>): number {
  if (row.media_type === "movie") return row.status === "watched" ? row.runtime ?? 0 : 0;
  const perEpisode = row.runtime || EPISODE_MINUTES_FALLBACK;
  const marked = episodesByTitle.get(row.id)?.length ?? 0;
  if (marked) return marked * perEpisode;
  if (row.status === "watched") return totalEpisodes(row.seasons ?? []) * perEpisode;
  return episodesBefore(row) * perEpisode;
}

/**
 * A Top 4 for someone who hasn't picked one, so a profile never starts empty:
 * Loved titles first, then Liked, then everything else seen, and within each
 * the ones they spent the most time on, then the most recent. Disliked titles
 * and anything without a poster are left out, and the first one with a
 * backdrop leads, because the first title's backdrop is the header.
 */
export function suggestTop(
  titles: TasteTitleRow[],
  episodesByTitle: Map<string, TasteEpisodeRow[]> = new Map(),
): TasteTitleRow[] {
  const rank = (row: TasteTitleRow) => {
    const rating = row.rating == null ? null : Number(row.rating);
    return rating === 3 ? 2 : rating === 2 ? 1 : 0;
  };
  const ranked = titles
    .filter(
      (row) =>
        (row.status === "watched" || row.status === "watching") &&
        row.poster_path &&
        Number(row.rating) !== 1,
    )
    .map((row) => ({ row, rank: rank(row), minutes: minutesOn(row, episodesByTitle) }))
    .sort(
      (a, b) =>
        b.rank - a.rank ||
        b.minutes - a.minutes ||
        time(b.row.watched_at ?? b.row.added_at) - time(a.row.watched_at ?? a.row.added_at) ||
        a.row.id.localeCompare(b.row.id),
    )
    .slice(0, TOP_TITLES_MAX)
    .map((entry) => entry.row);
  const lead = ranked.findIndex((row) => row.backdrop_path);
  if (lead > 0) ranked.unshift(...ranked.splice(lead, 1));
  return ranked;
}

/** Keep a picked list valid: known ids, no repeats, at most four. */
export function normalizeTopIds(ids: unknown, known: Set<string>): string[] {
  if (!Array.isArray(ids)) return [];
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || !known.has(id) || out.includes(id)) continue;
    out.push(id);
    if (out.length === TOP_TITLES_MAX) break;
  }
  return out;
}
