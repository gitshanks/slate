"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type TitleRow, type TitleStatus } from "@/lib/supabase";
import { getLibraryClient } from "@/lib/library-db";
import { APP_ROOT } from "@/lib/public-mode";
import { getMovie, getTv, normalizeForStorage } from "@/lib/tmdb";
import { getOmdbRatings } from "@/lib/omdb";
import { slugify } from "@/lib/utils";

async function nextStatusPosition(
  db: SupabaseClient,
  status: TitleStatus
): Promise<number> {
  const { data } = await db
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
  const db = await getLibraryClient();
  const { data: existingRows, error: existingError } = await db
    .from("titles")
    .select("id")
    .eq("tmdb_id", input.tmdbId)
    .eq("media_type", input.mediaType)
    .limit(1);
  if (existingError) throw new Error(existingError.message);
  if (existingRows?.[0]?.id) {
    revalidateLibrary();
    return existingRows[0] as { id: string };
  }

  const detail =
    input.mediaType === "movie" ? await getMovie(input.tmdbId) : await getTv(input.tmdbId);
  const normalized = normalizeForStorage(input.mediaType, detail);
  const omdb = normalized.imdb_id
    ? await getOmdbRatings(normalized.imdb_id)
    : { imdb_rating: null, imdb_votes: null, rt_score: null, metacritic_score: null };

  const status = input.status ?? "want";
  const position = await nextStatusPosition(db, status);
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

  const { data, error } = await db
    .from("titles")
    .insert(patch)
    .select("id")
    .single();

  if (error) {
    // A second request may have inserted the same title between our read and
    // write. Resolve that benign race without relying on a particular
    // single-user vs hosted unique-constraint shape.
    if (error.message.toLowerCase().includes("duplicate")) {
      const { data: racedRows } = await db
        .from("titles")
        .select("id")
        .eq("tmdb_id", input.tmdbId)
        .eq("media_type", input.mediaType)
        .limit(1);
      if (racedRows?.[0]?.id) return racedRows[0] as { id: string };
    }
    throw new Error(error.message);
  }
  revalidateLibrary();
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
  const db = await getLibraryClient();
  const patch: Record<string, unknown> = {
    status,
    position: await nextStatusPosition(db, status),
  };
  if (status === "watched") patch.watched_at = new Date().toISOString();
  if (status !== "watched") patch.watched_at = null;

  const { error } = await db.from("titles").update(patch).eq("id", titleId);
  if (error) throw new Error(error.message);

  revalidateLibrary();
}

export async function setRating(titleId: string, rating: number | null) {
  const db = await getLibraryClient();
  const { error } = await db
    .from("titles")
    .update({ rating })
    .eq("id", titleId);
  if (error) throw new Error(error.message);
  revalidatePath(`/title/${titleId}`);
}

export async function setReview(titleId: string, review: string) {
  const db = await getLibraryClient();
  const { error } = await db
    .from("titles")
    .update({ review: review.trim() || null })
    .eq("id", titleId);
  if (error) throw new Error(error.message);
  revalidatePath(`/title/${titleId}`);
}

export async function toggleFavorite(titleId: string) {
  const db = await getLibraryClient();
  const { data, error: readErr } = await db
    .from("titles")
    .select("favorite")
    .eq("id", titleId)
    .single();
  if (readErr) throw new Error(readErr.message);

  const { error } = await db
    .from("titles")
    .update({ favorite: !data?.favorite })
    .eq("id", titleId);
  if (error) throw new Error(error.message);
  revalidatePath(`/title/${titleId}`);
}

export async function removeTitle(titleId: string) {
  const db = await getLibraryClient();
  const { error } = await db.from("titles").delete().eq("id", titleId);
  if (error) throw new Error(error.message);
  revalidateLibrary();
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
  const db = await getLibraryClient();
  if (!REORDERABLE_STATUSES.includes(status)) {
    throw new Error("Invalid title collection");
  }
  const order = validateOrder(orderedTitleIds);

  const { data, error: readError } = await db
    .from("titles")
    .select("*")
    .eq("status", status);
  if (readError) throw new Error(readError.message);

  const titles = (data ?? []) as TitleRow[];
  if (!hasSameIds(titles.map((title) => title.id), order)) {
    throw new Error("This collection changed. Refresh and try again.");
  }

  const results = await Promise.all(
    order.map((id, position) =>
      db.from("titles").update({ position }).eq("id", id)
    )
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw new Error(failed.error.message);

  if (status === "want") revalidateLibrary();
  else revalidatePath(`/${status}`);
}

export async function reorderListTitles(
  listId: string,
  orderedTitleIds: string[]
) {
  const db = await getLibraryClient();
  if (!listId) throw new Error("Invalid list");
  const order = validateOrder(orderedTitleIds);

  const { data, error: readError } = await db
    .from("list_titles")
    .select("title_id")
    .eq("list_id", listId);
  if (readError) throw new Error(readError.message);

  const actualIds = (data ?? []).map((row) => String(row.title_id));
  if (!hasSameIds(actualIds, order)) {
    throw new Error("This list changed. Refresh and try again.");
  }

  const results = await Promise.all(
    order.map((titleId, position) =>
      db
        .from("list_titles")
        .update({ position })
        .eq("list_id", listId)
        .eq("title_id", titleId)
    )
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw new Error(failed.error.message);

  revalidatePath("/lists", "layout");
}

// ─── Lists ────────────────────────────────────────────────────────

export async function createList(formData: FormData) {
  const db = await getLibraryClient();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!name) throw new Error("Name required");

  const slug = slugify(name);
  const { error } = await db.from("lists").insert({
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
  const db = await getLibraryClient();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name required");

  const slug = slugify(trimmed);
  const { data: ownedTitle, error: titleError } = await db
    .from("titles")
    .select("id")
    .eq("id", titleId)
    .maybeSingle();
  if (titleError || !ownedTitle) throw new Error("Title not found");

  const { data, error } = await db
    .from("lists")
    .insert({ name: trimmed, slug, description: null })
    .select("id, name")
    .single();
  if (error) throw new Error(error.message);
  const list = data as { id: string; name: string };

  const { error: linkErr } = await db.from("list_titles").insert({
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
  const db = await getLibraryClient();
  const [{ data: list }, { data: title }] = await Promise.all([
    db.from("lists").select("id").eq("id", listId).maybeSingle(),
    db.from("titles").select("id").eq("id", titleId).maybeSingle(),
  ]);
  if (!list || !title) throw new Error("List or title not found");

  const { data: lastRows } = await db
    .from("list_titles")
    .select("position")
    .eq("list_id", listId)
    .order("position", { ascending: false })
    .limit(1);
  const lastPosition = Number(lastRows?.[0]?.position);
  const { error } = await db.from("list_titles").insert({
    list_id: listId,
    title_id: titleId,
    position: Number.isFinite(lastPosition) ? lastPosition + 1 : 0,
  });
  if (error && !error.message.includes("duplicate")) throw new Error(error.message);
  revalidatePath("/lists");
}

export async function removeTitleFromList(listId: string, titleId: string) {
  const db = await getLibraryClient();
  const { error } = await db
    .from("list_titles")
    .delete()
    .eq("list_id", listId)
    .eq("title_id", titleId);
  if (error) throw new Error(error.message);
  revalidatePath("/lists");
}

export async function deleteList(listId: string) {
  const db = await getLibraryClient();
  const { error } = await db.from("lists").delete().eq("id", listId);
  if (error) throw new Error(error.message);
  revalidatePath("/lists");
  redirect("/lists");
}

function revalidateLibrary() {
  revalidatePath("/", "layout");
  if (APP_ROOT !== "/") revalidatePath(APP_ROOT, "layout");
}
