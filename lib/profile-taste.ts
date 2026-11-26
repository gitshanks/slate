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

/**
 * The Top 4 lives in profiles.top_title_ids: title ids in order, added by
 * supabase/migrations/20261125_profile_top_titles.sql (`npm run
 * db:migrate:top`). The app never changes the schema itself. Until the
 * migration runs, profiles read as having no Top 4 and saving one fails.
 * Ids of titles since removed are skipped when the profile is read.
 */
function missingTopColumn(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code ?? "") : "";
  const message = "message" in error ? String(error.message ?? "") : "";
  return /top_title_ids/.test(message) && (code === "42703" || /does not exist/i.test(message));
}

export async function getTopTitleIds(ownerId: string): Promise<string[]> {
  if (!process.env.DATABASE_URL) return [];
  try {
    const rows = await runNeonQuery<{ top_title_ids: string[] | null }>(
      "select top_title_ids from profiles where id = $1",
      [ownerId],
    );
    return rows[0]?.top_title_ids ?? [];
  } catch (error) {
    if (missingTopColumn(error)) return [];
    throw error;
  }
}

/**
 * The bio lives in profiles.bio, added by
 * supabase/migrations/20261126_profile_bio.sql (`npm run db:migrate:bio`).
 * Until it runs, `supported` is false and Edit profile hides the field.
 */
export const BIO_MAX = 160;

function missingColumn(error: unknown, column: string): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code ?? "") : "";
  const message = "message" in error ? String(error.message ?? "") : "";
  return message.includes(column) && (code === "42703" || /does not exist/i.test(message));
}

export async function getProfileBio(
  ownerId: string,
): Promise<{ supported: boolean; bio: string | null }> {
  if (!process.env.DATABASE_URL) return { supported: false, bio: null };
  try {
    const rows = await runNeonQuery<{ bio: string | null }>(
      "select bio from profiles where id = $1",
      [ownerId],
    );
    return { supported: true, bio: rows[0]?.bio?.trim() || null };
  } catch {
    // Before the migration (or if the read fails) the field stays hidden.
    return { supported: false, bio: null };
  }
}

/** Save a bio: whitespace runs collapse, empty clears it. */
export async function saveProfileBio(ownerId: string, bio: string): Promise<string | null> {
  const clean = bio.replace(/\s+/g, " ").trim().slice(0, BIO_MAX) || null;
  try {
    await runNeonQuery(
      "update profiles set bio = $2, updated_at = now() where id = $1",
      [ownerId, clean],
    );
  } catch (error) {
    if (missingColumn(error, "bio")) {
      throw new Error("Bio needs the profile_bio migration: run npm run db:migrate:bio.");
    }
    throw error;
  }
  return clean;
}

/** Save an ordered Top 4, keeping only titles on this owner's slate. */
export async function saveTopTitleIds(ownerId: string, ids: unknown): Promise<string[]> {
  if (!process.env.DATABASE_URL) {
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
  try {
    await runNeonQuery(
      "update profiles set top_title_ids = $2::uuid[], updated_at = now() where id = $1",
      [ownerId, clean],
    );
  } catch (error) {
    if (missingTopColumn(error)) {
      throw new Error("Top 4 needs the profile_top_titles migration: run npm run db:migrate:top.");
    }
    throw error;
  }
  return clean;
}

type LibraryRead = {
  titles: TasteTitleRow[];
  episodes: TasteEpisodeRow[];
  listCount: number;
  topIds: string[];
  bio: string | null;
} | null;

/** One read of an owner's library, shared by everything on the profile. */
const readLibrary = cache(async (ownerId: string): Promise<LibraryRead> => {
  const db = libraryClientForOwner(ownerId);
  try {
    const [titles, episodes, lists, topIds, bio] = await Promise.all([
      db.from("titles").select(TASTE_COLUMNS),
      db.from("watched_episodes").select("title_id, watched_at"),
      db.from("lists").select("id"),
      getTopTitleIds(ownerId).catch(() => [] as string[]),
      getProfileBio(ownerId),
    ]);
    if (titles.error) return null;
    return {
      titles: (titles.data ?? []) as unknown as TasteTitleRow[],
      // Episode and list counts are a nicety: a failed read shows fewer.
      episodes: (episodes.error ? [] : episodes.data ?? []) as unknown as TasteEpisodeRow[],
      listCount: lists.error ? 0 : (lists.data ?? []).length,
      topIds,
      bio: bio.bio,
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
