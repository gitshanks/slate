import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { libraryClientForOwner } from "@/lib/library-db";
import { titleDTO } from "@/lib/native-api/dto";
import { NativeApiError } from "@/lib/native-api/http";
import {
  cascadeKeys,
  episodeKey,
  isComplete,
  nextUnwatched,
  type SeasonCount,
} from "@/lib/episode-progress";
import type { TitleRow, TitleStatus } from "@/lib/types";

/**
 * Playback progress reported by a native player (the TV launcher). Mirrors the
 * shelf rules in lib/episode-actions.ts, which are bound to the web session:
 * first play moves Up Next to Watching, a finished episode cascades backwards
 * and moves the resume pointer to the next unwatched one, a finished series or
 * movie moves to Watched. Dropped titles are never moved.
 */
export interface ProgressInput {
  season: number | null;
  episode: number | null;
  completed: boolean;
}

async function moveTo(db: SupabaseClient, titleId: string, status: TitleStatus) {
  const { data } = await db
    .from("titles")
    .select("position")
    .eq("status", status)
    .order("position", { ascending: true })
    .limit(1);
  const front = Number(data?.[0]?.position);
  const { error } = await db
    .from("titles")
    .update({
      status,
      position: Number.isFinite(front) ? front - 1 : 0,
      watched_at: status === "watched" ? new Date().toISOString() : null,
    })
    .eq("id", titleId);
  if (error) throw new Error(error.message);
}

async function readWatched(db: SupabaseClient, titleId: string): Promise<Set<string>> {
  const { data, error } = await db
    .from("watched_episodes")
    .select("season, episode")
    .eq("title_id", titleId);
  if (error) throw new Error(error.message);
  return new Set(
    ((data ?? []) as { season: number; episode: number }[]).map((row) =>
      episodeKey(Number(row.season), Number(row.episode)),
    ),
  );
}

export async function recordNativeProgress(
  ownerId: string,
  titleId: string,
  input: ProgressInput,
) {
  const db = libraryClientForOwner(ownerId);
  const { data, error } = await db
    .from("titles")
    .select("*")
    .eq("id", titleId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new NativeApiError(404, "not_found", "This title is not in your library.");

  const title = data as TitleRow;
  let status = title.status as TitleStatus;
  const isEpisode = title.media_type === "tv" && input.season != null && input.episode != null;

  if (status !== "dropped") {
    if (isEpisode) {
      const season = input.season as number;
      const episode = input.episode as number;
      const seasons: SeasonCount[] = Array.isArray(title.seasons) ? title.seasons : [];
      const current =
        title.current_season != null && title.current_episode != null
          ? { season: title.current_season, episode: title.current_episode }
          : null;
      let pointer = current;

      if (input.completed) {
        const watched = await readWatched(db, titleId);
        const missing = cascadeKeys(seasons, season, episode).filter((key) => !watched.has(key));
        if (missing.length > 0) {
          const { error: insertError } = await db.from("watched_episodes").insert(
            missing.map((key) => {
              const [s, e] = key.split(":");
              return { title_id: titleId, season: Number(s), episode: Number(e) };
            }),
          );
          if (insertError) throw new Error(insertError.message);
          for (const key of missing) watched.add(key);
        }
        pointer = nextUnwatched(seasons, watched) ?? { season, episode };
        if (isComplete(seasons, watched)) {
          if (status !== "watched") await moveTo(db, titleId, "watched");
          status = "watched";
        }
      } else if (
        !current ||
        season > current.season ||
        (season === current.season && episode > current.episode)
      ) {
        // A started episode becomes the resume point, never rewinding it.
        pointer = { season, episode };
      }

      if (
        pointer &&
        (pointer.season !== title.current_season || pointer.episode !== title.current_episode)
      ) {
        const { error: pointerError } = await db
          .from("titles")
          .update({ current_season: pointer.season, current_episode: pointer.episode })
          .eq("id", titleId);
        if (pointerError) throw new Error(pointerError.message);
      }
    } else if (input.completed && title.media_type === "movie" && status !== "watched") {
      await moveTo(db, titleId, "watched");
      status = "watched";
    }

    if (status === "want") await moveTo(db, titleId, "watching");
  }

  const { data: updated, error: readError } = await db
    .from("titles")
    .select("*")
    .eq("id", titleId)
    .single();
  if (readError || !updated) throw new Error(readError?.message ?? "Title vanished.");
  return titleDTO(updated as TitleRow);
}
