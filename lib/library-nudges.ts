import "server-only";

import { episodeKey } from "@/lib/episode-progress";
import { libraryClientForOwner } from "@/lib/library-db";
import { getTv } from "@/lib/tmdb";
import type { TitleRow } from "@/lib/types";

/**
 * The prompts the Library shows above the shelf, each answering a finding on
 * the insights page (lib/admin-insights.ts):
 * - under five titles: the onboarding picks and the importers, the two
 *   fastest ways to a library worth having;
 * - a show you are watching has a new episode out: a reason to come back;
 * - ten titles and no list yet: a list made from what you already saved.
 */

export const SMALL_LIBRARY_TITLES = 5;
export const LIST_SUGGESTION_TITLES = 10;

/** How long an aired episode counts as new. */
const NEW_EPISODE_DAYS = 14;
/** TMDB lookups per Library load; each is cached for an hour. */
const MAX_SHOWS_CHECKED = 16;

export async function savedTitleKeys(ownerId: string): Promise<Set<string>> {
  const { data, error } = await libraryClientForOwner(ownerId)
    .from("titles")
    .select("tmdb_id, media_type");
  if (error) throw new Error(error.message);
  return new Set(
    ((data ?? []) as { tmdb_id: number; media_type: string }[]).map(
      (row) => `${row.media_type}:${row.tmdb_id}`,
    ),
  );
}

export async function countLibraryTitles(ownerId: string) {
  return (await savedTitleKeys(ownerId)).size;
}

export interface NewEpisode {
  titleId: string;
  title: string;
  posterPath: string | null;
  season: number;
  episode: number;
  episodeName: string;
  airDate: string;
}

/**
 * Shows on the Watching shelf whose newest aired episode is under two weeks
 * old and not yet marked watched. Newest first.
 */
export async function getNewEpisodes(
  ownerId: string,
  titles: TitleRow[],
): Promise<NewEpisode[]> {
  const shows = titles
    .filter((title) => title.media_type === "tv" && title.status === "watching")
    .slice(0, MAX_SHOWS_CHECKED);
  if (!shows.length) return [];

  const cutoff = Date.now() - NEW_EPISODE_DAYS * 86_400_000;
  const candidates = (
    await Promise.all(
      shows.map(async (show) => {
        try {
          const latest = (await getTv(show.tmdb_id)).last_episode_to_air;
          if (!latest?.air_date || latest.season_number < 1) return null;
          const aired = Date.parse(`${latest.air_date}T00:00:00Z`);
          if (!Number.isFinite(aired) || aired < cutoff || aired > Date.now()) return null;
          return { show, latest };
        } catch {
          return null;
        }
      }),
    )
  ).filter((item) => item !== null);
  if (!candidates.length) return [];

  let watched = new Set<string>();
  try {
    const { data } = await libraryClientForOwner(ownerId)
      .from("watched_episodes")
      .select("title_id, season, episode")
      .in(
        "title_id",
        candidates.map(({ show }) => show.id),
      );
    watched = new Set(
      ((data ?? []) as { title_id: string; season: number; episode: number }[]).map(
        (row) => `${row.title_id}|${episodeKey(Number(row.season), Number(row.episode))}`,
      ),
    );
  } catch {
    // No episode table (demo backends): every recent episode counts as new.
  }

  return candidates
    .filter(
      ({ show, latest }) =>
        !watched.has(`${show.id}|${episodeKey(latest.season_number, latest.episode_number)}`),
    )
    .map(({ show, latest }) => ({
      titleId: show.id,
      title: show.title,
      posterPath: show.poster_path,
      season: latest.season_number,
      episode: latest.episode_number,
      episodeName: latest.name,
      airDate: latest.air_date!,
    }))
    .sort((a, b) => b.airDate.localeCompare(a.airDate));
}

export interface ListSuggestion {
  name: string;
  titleIds: string[];
  posterPaths: string[];
}

/**
 * A first list drawn from the library: the genre with the most titles still
 * to watch, so the list is something to pick from on a night in.
 */
export function suggestList(titles: TitleRow[]): ListSuggestion | null {
  if (titles.length < LIST_SUGGESTION_TITLES) return null;
  const unwatched = titles.filter((title) => title.status === "want" || title.status === "watching");
  const pool = unwatched.length >= 4 ? unwatched : titles;
  const byGenre = new Map<string, TitleRow[]>();
  for (const title of pool) {
    for (const genre of title.genres ?? []) {
      if (!genre?.name) continue;
      const group = byGenre.get(genre.name) ?? [];
      group.push(title);
      byGenre.set(genre.name, group);
    }
  }
  const [genre, group] =
    [...byGenre.entries()].sort((a, b) => b[1].length - a[1].length)[0] ?? [];
  if (!genre || !group || group.length < 4) return null;
  const picked = group.slice(0, 12);
  return {
    name: `${genre.replace(/ & /g, " and ")} night`,
    titleIds: picked.map((title) => title.id),
    posterPaths: picked
      .map((title) => title.poster_path)
      .filter((path): path is string => Boolean(path))
      .slice(0, 4),
  };
}
