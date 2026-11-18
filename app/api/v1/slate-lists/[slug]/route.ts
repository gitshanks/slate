import { libraryClientForOwner } from "@/lib/library-db";
import { addNativeTitle } from "@/lib/native-api/catalog";
import { apiData, apiError, NativeApiError } from "@/lib/native-api/http";
import { authenticateNativeRequest } from "@/lib/native-api/tokens";
import { getSlateList } from "@/lib/slate-lists";
import { slugify } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

async function findList(context: Context) {
  const { slug } = await context.params;
  const found = await getSlateList(slug);
  if (!found) throw new NativeApiError(404, "not_found", "That list is no longer here.");
  return found;
}

/** A list made by Slate (the web's /l/<slug>), for the phone apps. */
export async function GET(request: Request, context: Context) {
  try {
    const [claims, found] = await Promise.all([
      authenticateNativeRequest(request),
      findList(context),
    ]);
    const { data } = await libraryClientForOwner(claims.ownerId)
      .from("titles")
      .select("tmdb_id, media_type");
    const saved = new Set(
      ((data ?? []) as { tmdb_id: number; media_type: string }[]).map(
        (row) => `${row.media_type}:${row.tmdb_id}`,
      ),
    );
    return apiData({
      slug: found.list.slug,
      name: found.list.name,
      description: found.list.description,
      curator: found.curator,
      titles: found.titles.map((title) => ({
        tmdbId: title.tmdb_id,
        mediaType: title.media_type,
        title: title.title,
        posterPath: title.poster_path,
        releaseDate: title.release_date,
        saved: saved.has(`${title.media_type}:${title.tmdb_id}`),
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}

/**
 * Copy the list into the signed-in library, as the web's "Add to your slate"
 * does: every title goes to Up Next (titles already saved keep their shelf)
 * and a list of the same name holds them in Slate's order. Safe to send twice.
 */
export async function POST(request: Request, context: Context) {
  try {
    const [claims, found] = await Promise.all([
      authenticateNativeRequest(request),
      findList(context),
    ]);
    const titleIds: string[] = [];
    for (const title of found.titles) {
      const row = await addNativeTitle(claims.ownerId, {
        tmdbId: title.tmdb_id,
        mediaType: title.media_type,
        status: "want",
      });
      titleIds.push(row.id);
    }
    if (!titleIds.length) throw new Error("Those titles could not be added.");

    const db = libraryClientForOwner(claims.ownerId);
    const { data: existing } = await db
      .from("lists")
      .select("id")
      .eq("name", found.list.name)
      .limit(1);
    let listId = (existing as { id: string }[] | null)?.[0]?.id;
    if (!listId) {
      const { data: created, error } = await db
        .from("lists")
        .insert({
          name: found.list.name,
          slug: slugify(found.list.name),
          description: found.list.description,
        })
        .select("id")
        .single();
      if (error || !created) throw new Error(error?.message || "List could not be created.");
      listId = (created as { id: string }).id;
    }

    const { data: present } = await db
      .from("list_titles")
      .select("title_id, position")
      .eq("list_id", listId);
    const rows = (present ?? []) as { title_id: string; position: number }[];
    const inList = new Set(rows.map((row) => row.title_id));
    let position = rows.reduce((max, row) => Math.max(max, Number(row.position) || 0), -1);
    for (const titleId of titleIds) {
      if (inList.has(titleId)) continue;
      position += 1;
      const { error } = await db
        .from("list_titles")
        .insert({ list_id: listId, title_id: titleId, position });
      if (error && !error.message.toLowerCase().includes("duplicate")) {
        throw new Error(error.message);
      }
    }
    return apiData({ added: titleIds.length, listId });
  } catch (error) {
    return apiError(error);
  }
}
