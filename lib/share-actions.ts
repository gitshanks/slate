"use server";

import { addTitle } from "@/lib/actions";
import { getLibraryClient } from "@/lib/library-db";

interface SharedTitleSelection {
  tmdbId: number;
  mediaType: "movie" | "tv";
}

export interface AddSharedTitlesResult {
  added: number;
  existing: number;
  failed: number;
}

export async function addSharedTitles(
  selections: SharedTitleSelection[],
): Promise<AddSharedTitlesResult> {
  if (!Array.isArray(selections) || selections.length === 0) {
    throw new Error("Select at least one title.");
  }
  if (selections.length > 12) throw new Error("Too many titles selected.");

  const unique = new Map<string, SharedTitleSelection>();
  for (const item of selections) {
    if (
      !item ||
      !Number.isInteger(item.tmdbId) ||
      item.tmdbId <= 0 ||
      (item.mediaType !== "movie" && item.mediaType !== "tv")
    ) {
      throw new Error("Invalid title selection.");
    }
    unique.set(`${item.tmdbId}:${item.mediaType}`, item);
  }

  const db = await getLibraryClient();
  const { data, error } = await db.from("titles").select("tmdb_id, media_type");
  if (error) throw new Error(error.message);
  const existingKeys = new Set(
    (data ?? []).map(
      (row) => `${Number(row.tmdb_id)}:${String(row.media_type)}`,
    ),
  );

  let added = 0;
  let existing = 0;
  let failed = 0;
  // addTitle puts each new item at the front. Reverse the operation so the
  // first recommendation in the shared link remains first in Up Next.
  for (const item of Array.from(unique.values()).reverse()) {
    const key = `${item.tmdbId}:${item.mediaType}`;
    if (existingKeys.has(key)) {
      existing += 1;
      continue;
    }
    try {
      await addTitle({
        tmdbId: item.tmdbId,
        mediaType: item.mediaType,
        status: "want",
      });
      added += 1;
    } catch {
      failed += 1;
    }
  }

  return { added, existing, failed };
}
