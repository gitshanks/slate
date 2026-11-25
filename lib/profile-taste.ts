import "server-only";

import { cache } from "react";
import { libraryClientForOwner } from "@/lib/library-db";
import { runNeonQuery } from "@/lib/neon-client";
import {
  computeProfileTaste,
  normalizeTopIds,
  type ProfileTaste,
  type TasteEpisodeRow,
  type TasteTitleRow,
} from "@/lib/profile-taste-core";
import type { TitleRow } from "@/lib/types";

export type { ProfileTaste } from "@/lib/profile-taste-core";

const TASTE_COLUMNS =
  "id, tmdb_id, media_type, title, poster_path, backdrop_path, release_date, runtime, genres, status, rating, added_at, watched_at, current_season, current_episode, seasons";

let schemaPromise: Promise<boolean> | null = null;

/**
 * Add the Top 4 column the first time a profile is read or saved, the same
 * way the onboarding marker arrived (supabase/migrations/20261125_profile_top_titles.sql
 * is the same change for a fresh database). The column holds title ids in
 * order; ids of titles since removed are skipped when it is read.
 */
export function ensureTopTitlesSchema() {
  if (!process.env.DATABASE_URL) return Promise.resolve(false);
  if (!schemaPromise) {
    schemaPromise = runNeonQuery(`
      do $$
      begin
        if not exists (
          select 1
          from information_schema.columns
          where table_schema = current_schema()
            and table_name = 'profiles'
            and column_name = 'top_title_ids'
        ) then
          alter table profiles add column top_title_ids uuid[] not null default '{}';
        end if;
      end $$;
    `)
      .then(() => true)
      .catch((error) => {
        schemaPromise = null;
        throw error;
      });
  }
  return schemaPromise;
}

export async function getTopTitleIds(ownerId: string): Promise<string[]> {
  if (!(await ensureTopTitlesSchema())) return [];
  const rows = await runNeonQuery<{ top_title_ids: string[] | null }>(
    "select top_title_ids from profiles where id = $1",
    [ownerId],
  );
  return rows[0]?.top_title_ids ?? [];
}

/** Save an ordered Top 4, keeping only titles on this owner's slate. */
export async function saveTopTitleIds(ownerId: string, ids: unknown): Promise<string[]> {
  if (!(await ensureTopTitlesSchema())) {
    throw new Error("Top 4 needs the hosted database.");
  }
  const candidates = Array.isArray(ids)
    ? ids.filter((id): id is string => typeof id === "string").slice(0, 12)
    : [];
  const owned = candidates.length
    ? await runNeonQuery<{ id: string }>(
        "select id::text as id from titles where owner_id = $1 and id::text = any($2::text[]) and status <> 'dropped'",
        [ownerId, candidates],
      )
    : [];
  const clean = normalizeTopIds(candidates, new Set(owned.map((row) => row.id)));
  await runNeonQuery(
    "update profiles set top_title_ids = $2::uuid[], updated_at = now() where id = $1",
    [ownerId, clean],
  );
  return clean;
}

type LibraryRead = {
  titles: TasteTitleRow[];
  episodes: TasteEpisodeRow[];
  listCount: number;
  topIds: string[];
} | null;

/** One read of an owner's library, shared by everything on the profile. */
const readLibrary = cache(async (ownerId: string): Promise<LibraryRead> => {
  const db = libraryClientForOwner(ownerId);
  try {
    const [titles, episodes, lists, topIds] = await Promise.all([
      db.from("titles").select(TASTE_COLUMNS),
      db.from("watched_episodes").select("title_id, watched_at"),
      db.from("lists").select("id"),
      getTopTitleIds(ownerId).catch(() => [] as string[]),
    ]);
    if (titles.error) return null;
    return {
      titles: (titles.data ?? []) as unknown as TasteTitleRow[],
      // Episode and list counts are a nicety: a failed read shows fewer.
      episodes: (episodes.error ? [] : episodes.data ?? []) as unknown as TasteEpisodeRow[],
      listCount: lists.error ? 0 : (lists.data ?? []).length,
      topIds,
    };
  } catch {
    return null;
  }
});

/**
 * Everything a profile shows, for one owner. Returns null when the library
 * can't be read, so the page can still show who the profile belongs to.
 */
export async function getProfileTaste(ownerId: string): Promise<ProfileTaste | null> {
  const library = await readLibrary(ownerId);
  return library ? computeProfileTaste(library) : null;
}

/** Every title that can go in the Top 4, for the picker. */
export async function getTopCandidates(ownerId: string) {
  const library = await readLibrary(ownerId);
  return (library?.titles ?? [])
    .filter((row) => row.status !== "dropped")
    .map((row) => ({
      id: row.id,
      title: row.title,
      posterPath: row.poster_path,
      year: row.release_date ? row.release_date.slice(0, 4) : null,
      status: row.status,
    }));
}

/** The full rows of the titles a profile shows, for their title cards. */
export async function getTasteRows(
  ownerId: string,
  taste: ProfileTaste | null,
): Promise<Record<string, TitleRow>> {
  if (!taste) return {};
  const ids = [
    ...new Set([...taste.top, ...taste.watching, ...taste.recent].map((poster) => poster.id)),
  ];
  if (!ids.length) return {};
  const { data, error } = await libraryClientForOwner(ownerId)
    .from("titles")
    .select("*")
    .in("id", ids);
  if (error || !data) return {};
  return Object.fromEntries((data as TitleRow[]).map((row) => [row.id, row]));
}
