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
  revalidatePath("/", "layout");
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

  revalidatePath("/", "layout");
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

export async function removeTitle(titleId: string) {
  const { error } = await supabase.from("titles").delete().eq("id", titleId);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
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
