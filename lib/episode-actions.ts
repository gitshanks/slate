"use server";

import { getLibraryClient } from "@/lib/library-db";
import type { TitleStatus } from "@/lib/supabase";
import { setStatus } from "@/lib/actions";
import {
  advancePointer,
  cascadeKeys,
  episodeKey,
  isComplete,
  nextUnwatched,
  type SeasonCount,
} from "@/lib/episode-progress";

export interface EpisodeTrackingState {
  status: TitleStatus;
  currentSeason: number | null;
  currentEpisode: number | null;
  watched: string[];
  /** Non-null when this call moved the title to a new shelf. */
  statusChanged: TitleStatus | null;
}

interface OwnedTitle {
  id: string;
  media_type: "movie" | "tv";
  status: TitleStatus;
  current_season: number | null;
  current_episode: number | null;
  seasons: SeasonCount[] | null;
}

async function readTitle(titleId: string): Promise<OwnedTitle | null> {
  try {
    const db = await getLibraryClient();
    const { data, error } = await db
      .from("titles")
      .select("id, media_type, status, current_season, current_episode, seasons")
      .eq("id", titleId)
      .maybeSingle();
    if (error || !data) return null;
    return data as OwnedTitle;
  } catch {
    return null;
  }
}

async function readWatched(titleId: string): Promise<Set<string>> {
  try {
    const db = await getLibraryClient();
    const { data, error } = await db
      .from("watched_episodes")
      .select("season, episode")
      .eq("title_id", titleId);
    if (error || !data) return new Set();
    return new Set(
      (data as { season: number; episode: number }[]).map((row) =>
        episodeKey(Number(row.season), Number(row.episode)),
      ),
    );
  } catch {
    // Demo/stub backends have no episode table — tracking stays session-local.
    return new Set();
  }
}

function seasonsOf(title: OwnedTitle): SeasonCount[] {
  return Array.isArray(title.seasons) ? title.seasons : [];
}

/** Move between shelves only on real transitions (repositions to the front). */
async function transitionTo(titleId: string, from: TitleStatus, to: TitleStatus) {
  if (from === to) return;
  await setStatus(titleId, to);
}

function stateOf(
  title: OwnedTitle,
  watched: Set<string>,
  statusChanged: TitleStatus | null,
): EpisodeTrackingState {
  return {
    status: statusChanged ?? title.status,
    currentSeason: title.current_season,
    currentEpisode: title.current_episode,
    watched: [...watched],
    statusChanged,
  };
}

/** Initial watched set for the picker. Empty when untracked or unavailable. */
export async function getWatchedEpisodes(titleId: string): Promise<string[]> {
  return [...(await readWatched(titleId))];
}

/**
 * Explicit play press. Up Next becomes Watching on first play; the resume
 * pointer advances past the played episode but never rewinds. Watched and
 * Dropped titles are left alone.
 */
export async function recordPlayback(input: {
  titleId: string;
  season?: number | null;
  episode?: number | null;
}): Promise<EpisodeTrackingState> {
  const title = await readTitle(input.titleId);
  if (!title) {
    return {
      status: "want",
      currentSeason: null,
      currentEpisode: null,
      watched: [],
      statusChanged: null,
    };
  }
  const watched = await readWatched(input.titleId);
  let statusChanged: TitleStatus | null = null;

  if (title.status === "want") {
    await transitionTo(title.id, title.status, "watching");
    statusChanged = "watching";
  }

  if (
    title.media_type === "tv" &&
    input.season != null &&
    input.episode != null
  ) {
    const current =
      title.current_season != null && title.current_episode != null
        ? { season: title.current_season, episode: title.current_episode }
        : null;
    const next = advancePointer(seasonsOf(title), current, {
      season: input.season,
      episode: input.episode,
    });
    if (!current || next.season !== current.season || next.episode !== current.episode) {
      try {
        const db = await getLibraryClient();
        await db
          .from("titles")
          .update({ current_season: next.season, current_episode: next.episode })
          .eq("id", title.id);
        title.current_season = next.season;
        title.current_episode = next.episode;
      } catch {
        // Session-local fallback below still updates the UI.
        title.current_season = next.season;
        title.current_episode = next.episode;
      }
    }
  }

  return stateOf(title, watched, statusChanged);
}

/**
 * Toggle one episode. Checking cascades backwards (a mid-series check-in
 * marks everything before it); completing the series moves it to Watched.
 * Unchecking a finished series reopens it as Watching.
 */
export async function setEpisodeWatched(input: {
  titleId: string;
  season: number;
  episode: number;
  watched: boolean;
}): Promise<EpisodeTrackingState> {
  const title = await readTitle(input.titleId);
  if (!title) {
    return {
      status: "want",
      currentSeason: null,
      currentEpisode: null,
      watched: [],
      statusChanged: null,
    };
  }
  const seasons = seasonsOf(title);
  const watched = await readWatched(input.titleId);
  let statusChanged: TitleStatus | null = null;

  try {
    const db = await getLibraryClient();
    if (input.watched) {
      const missing = cascadeKeys(seasons, input.season, input.episode).filter(
        (key) => !watched.has(key),
      );
      if (missing.length > 0) {
        const { error } = await db.from("watched_episodes").insert(
          missing.map((key) => {
            const [s, e] = key.split(":");
            return { title_id: title.id, season: Number(s), episode: Number(e) };
          }),
        );
        if (error) throw new Error(error.message);
      }
      for (const key of missing) watched.add(key);
    } else {
      const { error } = await db
        .from("watched_episodes")
        .delete()
        .eq("title_id", title.id)
        .eq("season", input.season)
        .eq("episode", input.episode);
      if (error) throw new Error(error.message);
      watched.delete(episodeKey(input.season, input.episode));
    }
  } catch {
    // Demo/stub: keep the toggle session-local.
    if (input.watched) {
      for (const key of cascadeKeys(seasons, input.season, input.episode)) {
        watched.add(key);
      }
    } else {
      watched.delete(episodeKey(input.season, input.episode));
    }
  }

  // Resume pointer follows the watched set: first unwatched, or the finale
  // once everything is checked.
  const next = nextUnwatched(seasons, watched);
  const pointer = next ?? { season: input.season, episode: input.episode };
  if (
    title.current_season !== pointer.season ||
    title.current_episode !== pointer.episode
  ) {
    try {
      const db = await getLibraryClient();
      await db
        .from("titles")
        .update({ current_season: pointer.season, current_episode: pointer.episode })
        .eq("id", title.id);
    } catch {
      // Session-local fallback.
    }
    title.current_season = pointer.season;
    title.current_episode = pointer.episode;
  }

  if (title.status !== "dropped") {
    if (input.watched && title.status === "want") {
      await transitionTo(title.id, title.status, "watching");
      statusChanged = "watching";
    }
    if (input.watched && isComplete(seasons, watched) && title.status !== "watched") {
      await transitionTo(title.id, title.status === "want" ? "watching" : title.status, "watched");
      statusChanged = "watched";
    }
    if (!input.watched && title.status === "watched") {
      await transitionTo(title.id, title.status, "watching");
      statusChanged = "watching";
    }
  }

  return stateOf(title, watched, statusChanged);
}

/** Bulk check/clear a whole season. */
export async function setSeasonWatched(input: {
  titleId: string;
  season: number;
  episodeCount: number;
  watched: boolean;
}): Promise<EpisodeTrackingState> {
  const title = await readTitle(input.titleId);
  if (!title) {
    return {
      status: "want",
      currentSeason: null,
      currentEpisode: null,
      watched: [],
      statusChanged: null,
    };
  }
  const seasons = seasonsOf(title);
  const watched = await readWatched(input.titleId);
  let statusChanged: TitleStatus | null = null;

  try {
    const db = await getLibraryClient();
    if (input.watched) {
      const missing: string[] = [];
      for (let e = 1; e <= input.episodeCount; e += 1) {
        const key = episodeKey(input.season, e);
        if (!watched.has(key)) missing.push(key);
      }
      if (missing.length > 0) {
        const { error } = await db.from("watched_episodes").insert(
          missing.map((key) => {
            const [s, e] = key.split(":");
            return { title_id: title.id, season: Number(s), episode: Number(e) };
          }),
        );
        if (error) throw new Error(error.message);
      }
      for (const key of missing) watched.add(key);
    } else {
      const { error } = await db
        .from("watched_episodes")
        .delete()
        .eq("title_id", title.id)
        .eq("season", input.season);
      if (error) throw new Error(error.message);
      for (let e = 1; e <= input.episodeCount; e += 1) {
        watched.delete(episodeKey(input.season, e));
      }
    }
  } catch {
    for (let e = 1; e <= input.episodeCount; e += 1) {
      const key = episodeKey(input.season, e);
      if (input.watched) watched.add(key);
      else watched.delete(key);
    }
  }

  const next = nextUnwatched(seasons, watched);
  const pointer = next ?? { season: input.season, episode: input.episodeCount };
  try {
    const db = await getLibraryClient();
    await db
      .from("titles")
      .update({ current_season: pointer.season, current_episode: pointer.episode })
      .eq("id", title.id);
  } catch {
    // Session-local fallback.
  }
  title.current_season = pointer.season;
  title.current_episode = pointer.episode;

  if (title.status !== "dropped") {
    if (input.watched && title.status === "want") {
      await transitionTo(title.id, title.status, "watching");
      statusChanged = "watching";
    }
    if (input.watched && isComplete(seasons, watched) && title.status !== "watched") {
      await transitionTo(title.id, title.status === "want" ? "watching" : title.status, "watched");
      statusChanged = "watched";
    }
    if (!input.watched && title.status === "watched") {
      await transitionTo(title.id, title.status, "watching");
      statusChanged = "watching";
    }
  }

  return stateOf(title, watched, statusChanged);
}

/** A finished movie moves to Watched (telemetry end or explicit finish). */
export async function markMovieWatched(titleId: string): Promise<EpisodeTrackingState> {
  const title = await readTitle(titleId);
  if (!title) {
    return {
      status: "want",
      currentSeason: null,
      currentEpisode: null,
      watched: [],
      statusChanged: null,
    };
  }
  let statusChanged: TitleStatus | null = null;
  if (title.status !== "watched" && title.status !== "dropped") {
    await transitionTo(title.id, title.status, "watched");
    statusChanged = "watched";
  }
  return stateOf(title, new Set(), statusChanged);
}
