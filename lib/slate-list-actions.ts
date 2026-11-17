"use server";

import { addTitle, addTitleToList, createListFromTitles } from "@/lib/actions";
import { getLibraryClient } from "@/lib/library-db";
import { getSlateList } from "@/lib/slate-lists";

/**
 * Copy a list made by Slate into the signed-in person's own slate: every title
 * goes into Up Next (titles already saved keep their shelf) and a list of the
 * same name holds them in Slate's order. Safe to press twice.
 */
export async function addSlateListToLibrary(slug: string): Promise<{ added: number }> {
  const found = await getSlateList(slug);
  if (!found) throw new Error("That list is no longer here.");

  const titleIds: string[] = [];
  for (const title of found.titles) {
    const row = await addTitle({
      tmdbId: title.tmdb_id,
      mediaType: title.media_type,
      status: "want",
    });
    if (row?.id) titleIds.push(row.id);
  }
  if (!titleIds.length) throw new Error("Those titles could not be added.");

  const db = await getLibraryClient();
  const { data: existing } = await db
    .from("lists")
    .select("id")
    .eq("name", found.list.name)
    .limit(1);
  const existingId = (existing as { id: string }[] | null)?.[0]?.id;

  if (existingId) {
    for (const titleId of titleIds) {
      try {
        await addTitleToList(existingId, titleId);
      } catch {
        // Already in the list.
      }
    }
  } else {
    await createListFromTitles(found.list.name, titleIds);
  }
  return { added: titleIds.length };
}
