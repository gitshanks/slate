"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabase, type TitleStatus } from "@/lib/supabase";
import { getMovie, getTv, normalizeForStorage } from "@/lib/tmdb";
import { getOmdbRatings } from "@/lib/omdb";
import { slugify } from "@/lib/utils";

/**
 * Add a TMDB title to the library. If it already exists, no-op
 * (we still revalidate so the UI reflects state).
 */
export async function addTitle(input: {
  tmdbId: number;
  mediaType: "movie" | "tv";
  status?: TitleStatus;
}) {
  const detail =
    input.mediaType === "movie" ? await getMovie(input.tmdbId) : await getTv(input.tmdbId);
  const normalized = normalizeForStorage(input.mediaType, detail);
  const omdb = normalized.imdb_id
    ? await getOmdbRatings(normalized.imdb_id)
    : { imdb_rating: null, imdb_votes: null, rt_score: null, metacritic_score: null };

  const status = input.status ?? "want";
  const patch: Record<string, unknown> = {
    ...normalized,
    ...omdb,
    ratings_fetched_at:
      omdb.imdb_rating != null ||
      omdb.rt_score != null ||
      omdb.metacritic_score != null
        ? new Date().toISOString()
        : null,
    status,
  };
  if (status === "watched") patch.watched_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("titles")
    .upsert(patch, { onConflict: "tmdb_id,media_type", ignoreDuplicates: false })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Called by the discover preview page's Add button via a <form>. Upserts the
 * title and redirects straight to its detail page — callers don't need to
 * await the returned id.
 */
export async function addTitleFromPreview(formData: FormData) {
  const tmdbId = Number(formData.get("tmdbId"));
  const mediaType = String(formData.get("mediaType")) as "movie" | "tv";
  if (!tmdbId || (mediaType !== "movie" && mediaType !== "tv")) {
    throw new Error("Invalid preview payload");
  }
  const row = await addTitle({ tmdbId, mediaType });
  if (!row?.id) throw new Error("Failed to add title");
  redirect(`/title/${row.id}`);
}

/**
 * Called by the status dropdown on the discover page. Adds the title
 * with the chosen status then redirects to the title detail page.
 */
export async function addTitleWithStatus(formData: FormData) {
  const tmdbId = Number(formData.get("tmdbId"));
  const mediaType = String(formData.get("mediaType")) as "movie" | "tv";
  const status = String(formData.get("status")) as TitleStatus;
  if (!tmdbId || (mediaType !== "movie" && mediaType !== "tv")) {
    throw new Error("Invalid payload");
  }
  const validStatuses: TitleStatus[] = ["want", "watching", "watched"];
  const row = await addTitle({
    tmdbId,
    mediaType,
    status: validStatuses.includes(status) ? status : "want",
  });
  if (!row?.id) throw new Error("Failed to add title");
  redirect(`/title/${row.id}`);
}

export async function setStatus(titleId: string, status: TitleStatus) {
  const patch: Record<string, unknown> = { status };
  if (status === "watched") patch.watched_at = new Date().toISOString();
  if (status !== "watched") patch.watched_at = null;

  const { error } = await supabase.from("titles").update(patch).eq("id", titleId);
  if (error) throw new Error(error.message);

  revalidatePath(`/title/${titleId}`);
}

export async function setRating(titleId: string, rating: number | null) {
  const { error } = await supabase
    .from("titles")
    .update({ rating })
    .eq("id", titleId);
  if (error) throw new Error(error.message);
  revalidatePath(`/title/${titleId}`);
}

export async function setReview(titleId: string, review: string) {
  const { error } = await supabase
    .from("titles")
    .update({ review: review.trim() || null })
    .eq("id", titleId);
  if (error) throw new Error(error.message);
  revalidatePath(`/title/${titleId}`);
}

export async function toggleFavorite(titleId: string) {
  const { data, error: readErr } = await supabase
    .from("titles")
    .select("favorite")
    .eq("id", titleId)
    .single();
  if (readErr) throw new Error(readErr.message);

  const { error } = await supabase
    .from("titles")
    .update({ favorite: !data?.favorite })
    .eq("id", titleId);
  if (error) throw new Error(error.message);
  revalidatePath(`/title/${titleId}`);
}

// ─── Episode position (TV only) ──────────────────────────────────────
//
// Position is stored as the *last episode the user watched*. Null/null means
// they're in "watching" but haven't logged any progress yet — first +1 sets
// the position to S1·E1.
//
// Both helpers mutate `current_season` + `current_episode` only. They do NOT
// touch status; the single exception is `advanceEpisode` flipping the show to
// "watched" once the user clears the final episode of the final season.

type SeasonMeta = { n: number; c: number };

function nextPosition(
  pos: { season: number | null; episode: number | null },
  seasons: SeasonMeta[],
): { season: number; episode: number; finished: boolean } | null {
  if (seasons.length === 0) return null;

  // No progress logged yet → start at S1·E1.
  if (pos.season == null || pos.episode == null) {
    return { season: seasons[0].n, episode: 1, finished: false };
  }

  const current = seasons.find((s) => s.n === pos.season);
  if (!current) {
    // Stored season isn't in TMDB's list anymore; reset to S1·E1.
    return { season: seasons[0].n, episode: 1, finished: false };
  }

  if (pos.episode < current.c) {
    return { season: pos.season, episode: pos.episode + 1, finished: false };
  }

  // End of this season — roll over to the next one if it exists.
  const idx = seasons.indexOf(current);
  const next = seasons[idx + 1];
  if (next) return { season: next.n, episode: 1, finished: false };

  // Last episode of the last season — show is finished.
  return { season: pos.season, episode: pos.episode, finished: true };
}

export async function advanceEpisode(titleId: string) {
  const { data, error: readErr } = await supabase
    .from("titles")
    .select("current_season, current_episode, seasons, status")
    .eq("id", titleId)
    .single();
  if (readErr) throw new Error(readErr.message);
  const row = data as {
    current_season: number | null;
    current_episode: number | null;
    seasons: SeasonMeta[] | null;
    status: TitleStatus;
  };

  const next = nextPosition(
    { season: row.current_season, episode: row.current_episode },
    row.seasons ?? [],
  );
  if (!next) return; // no seasons metadata — nothing to do

  const patch: Record<string, unknown> = {
    current_season: next.season,
    current_episode: next.episode,
  };
  if (next.finished) {
    patch.status = "watched";
    patch.watched_at = new Date().toISOString();
  }

  const { error } = await supabase.from("titles").update(patch).eq("id", titleId);
  if (error) throw new Error(error.message);

  revalidatePath(`/title/${titleId}`);
}

export async function setEpisodePosition(
  titleId: string,
  season: number | null,
  episode: number | null,
) {
  const patch: Record<string, unknown> = {
    current_season: season,
    current_episode: episode,
  };
  const { error } = await supabase.from("titles").update(patch).eq("id", titleId);
  if (error) throw new Error(error.message);

  revalidatePath(`/title/${titleId}`);
}

export async function removeTitle(titleId: string) {
  const { error } = await supabase.from("titles").delete().eq("id", titleId);
  if (error) throw new Error(error.message);
}

// ─── Lists ────────────────────────────────────────────────────────

export async function createList(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!name) throw new Error("Name required");

  const slug = slugify(name);
  const { error } = await supabase.from("lists").insert({
    name,
    slug,
    description: description || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/lists");
  redirect(`/lists/${slug}`);
}

/**
 * Create a new list and add a title to it in one step. Used by the
 * "Create new list" affordance inside the Add-to-list popover on the
 * title detail page, where we want to stay on the title page rather
 * than redirect away.
 */
export async function createListAndAddTitle(
  name: string,
  titleId: string
): Promise<{ id: string; name: string }> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name required");

  const slug = slugify(trimmed);
  const { data, error } = await supabase
    .from("lists")
    .insert({ name: trimmed, slug, description: null })
    .select("id, name")
    .single();
  if (error) throw new Error(error.message);
  const list = data as { id: string; name: string };

  const { error: linkErr } = await supabase.from("list_titles").insert({
    list_id: list.id,
    title_id: titleId,
  });
  if (linkErr && !linkErr.message.includes("duplicate")) {
    throw new Error(linkErr.message);
  }
  revalidatePath("/lists");
  revalidatePath(`/title/${titleId}`);
  return list;
}

export async function addTitleToList(listId: string, titleId: string) {
  const { error } = await supabase.from("list_titles").insert({
    list_id: listId,
    title_id: titleId,
  });
  if (error && !error.message.includes("duplicate")) throw new Error(error.message);
  revalidatePath("/lists");
}

export async function removeTitleFromList(listId: string, titleId: string) {
  const { error } = await supabase
    .from("list_titles")
    .delete()
    .eq("list_id", listId)
    .eq("title_id", titleId);
  if (error) throw new Error(error.message);
  revalidatePath("/lists");
}

export async function deleteList(listId: string) {
  const { error } = await supabase.from("lists").delete().eq("id", listId);
  if (error) throw new Error(error.message);
  revalidatePath("/lists");
  redirect("/lists");
}
