"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabase, type TitleRow, type TitleStatus } from "@/lib/supabase";
import { getMovie, getTv, normalizeForStorage } from "@/lib/tmdb";
import { getOmdbRatings } from "@/lib/omdb";
import { slugify } from "@/lib/utils";

async function nextStatusPosition(status: TitleStatus): Promise<number> {
  const { data } = await supabase
    .from("titles")
    .select("position")
    .eq("status", status)
    .order("position", { ascending: true })
    .limit(1);
  const current = Number(data?.[0]?.position);
  return Number.isFinite(current) ? current - 1 : 0;
}

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
  const position = await nextStatusPosition(status);
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
    position,
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
  const patch: Record<string, unknown> = {
    status,
    position: await nextStatusPosition(status),
  };
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

// ─── Reordering ───────────────────────────────────────────────────

const REORDERABLE_STATUSES = ["want", "watching", "watched"] as const;
type ReorderableStatus = (typeof REORDERABLE_STATUSES)[number];

function validateOrder(ids: string[]): string[] {
  if (ids.length > 5000) throw new Error("Too many titles to reorder");
  if (ids.some((id) => typeof id !== "string" || id.length === 0)) {
    throw new Error("Invalid title order");
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error("Title order contains duplicates");
  }
  return ids;
}

function hasSameIds(actualIds: string[], orderedIds: string[]): boolean {
  if (actualIds.length !== orderedIds.length) return false;
  const actual = new Set(actualIds);
  return orderedIds.every((id) => actual.has(id));
}

export async function reorderStatusTitles(
  status: ReorderableStatus,
  orderedTitleIds: string[]
) {
  if (!REORDERABLE_STATUSES.includes(status)) {
    throw new Error("Invalid title collection");
  }
  const order = validateOrder(orderedTitleIds);

  const { data, error: readError } = await supabase
    .from("titles")
    .select("*")
    .eq("status", status);
  if (readError) throw new Error(readError.message);

  const titles = (data ?? []) as TitleRow[];
  if (!hasSameIds(titles.map((title) => title.id), order)) {
    throw new Error("This collection changed. Refresh and try again.");
  }

  const byId = new Map(titles.map((title) => [title.id, title]));
  const rows = order.map((id, position) => ({
    ...byId.get(id)!,
    position,
  }));
  const { error } = await supabase
    .from("titles")
    .upsert(rows, { onConflict: "id", ignoreDuplicates: false });
  if (error) throw new Error(error.message);

  revalidatePath(status === "want" ? "/" : `/${status}`);
}

export async function reorderListTitles(
  listId: string,
  orderedTitleIds: string[]
) {
  if (!listId) throw new Error("Invalid list");
  const order = validateOrder(orderedTitleIds);

  const { data, error: readError } = await supabase
    .from("list_titles")
    .select("title_id")
    .eq("list_id", listId);
  if (readError) throw new Error(readError.message);

  const actualIds = (data ?? []).map((row) => String(row.title_id));
  if (!hasSameIds(actualIds, order)) {
    throw new Error("This list changed. Refresh and try again.");
  }

  const rows = order.map((titleId, position) => ({
    list_id: listId,
    title_id: titleId,
    position,
  }));
  const { error } = await supabase
    .from("list_titles")
    .upsert(rows, {
      onConflict: "list_id,title_id",
      ignoreDuplicates: false,
    });
  if (error) throw new Error(error.message);

  revalidatePath("/lists", "layout");
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
    position: 0,
  });
  if (linkErr && !linkErr.message.includes("duplicate")) {
    throw new Error(linkErr.message);
  }
  revalidatePath("/lists");
  revalidatePath(`/title/${titleId}`);
  return list;
}

export async function addTitleToList(listId: string, titleId: string) {
  const { data: lastRows } = await supabase
    .from("list_titles")
    .select("position")
    .eq("list_id", listId)
    .order("position", { ascending: false })
    .limit(1);
  const lastPosition = Number(lastRows?.[0]?.position);
  const { error } = await supabase.from("list_titles").insert({
    list_id: listId,
    title_id: titleId,
    position: Number.isFinite(lastPosition) ? lastPosition + 1 : 0,
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
