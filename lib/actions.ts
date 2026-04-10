"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabase, type TitleStatus } from "@/lib/supabase";
import { getMovie, getTv, normalizeForStorage } from "@/lib/tmdb";
import { slugify } from "@/lib/utils";

/**
 * Add a TMDB title to the library. If it already exists, no-op
 * (we still revalidate so the UI reflects state).
 */
export async function addTitle(input: { tmdbId: number; mediaType: "movie" | "tv" }) {
  const detail =
    input.mediaType === "movie" ? await getMovie(input.tmdbId) : await getTv(input.tmdbId);
  const normalized = normalizeForStorage(input.mediaType, detail);

  const { data, error } = await supabase
    .from("titles")
    .upsert(
      { ...normalized, status: "want" },
      { onConflict: "tmdb_id,media_type", ignoreDuplicates: false }
    )
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/watched");
  return data;
}

export async function setStatus(titleId: string, status: TitleStatus) {
  const patch: Record<string, unknown> = { status };
  if (status === "watched") patch.watched_at = new Date().toISOString();
  if (status !== "watched") patch.watched_at = null;

  const { error } = await supabase.from("titles").update(patch).eq("id", titleId);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/watched");
  revalidatePath(`/title/${titleId}`);
}

export async function setRating(titleId: string, rating: number | null) {
  const { error } = await supabase
    .from("titles")
    .update({ rating })
    .eq("id", titleId);
  if (error) throw new Error(error.message);
  revalidatePath(`/title/${titleId}`);
  revalidatePath("/watched");
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
  revalidatePath("/");
  revalidatePath("/watched");
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
