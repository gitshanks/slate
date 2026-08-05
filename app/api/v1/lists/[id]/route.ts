import { libraryClientForOwner } from "@/lib/library-db";
import { listDTO, titleDTO } from "@/lib/native-api/dto";
import { apiData, apiError, NativeApiError, optionalString, readJsonObject } from "@/lib/native-api/http";
import { authenticateNativeRequest } from "@/lib/native-api/tokens";
import type { ListRow, TitleRow } from "@/lib/types";
import { slugify } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: RouteContext<"/api/v1/lists/[id]">,
) {
  try {
    const [claims, params] = await Promise.all([
      authenticateNativeRequest(request),
      context.params,
    ]);
    const db = libraryClientForOwner(claims.ownerId);
    const [{ data: list, error: listError }, { data: rows, error: rowsError }] = await Promise.all([
      db.from("lists").select("*").eq("id", params.id).maybeSingle(),
      db.from("list_titles")
        .select("title_id, position, titles(*)")
        .eq("list_id", params.id)
        .order("position", { ascending: true }),
    ]);
    if (listError || !list) throw new NativeApiError(404, "not_found", "List not found.");
    if (rowsError) throw new Error(rowsError.message);
    const titles = (rows ?? []).flatMap((row) => {
      const embedded = row.titles as unknown as TitleRow | TitleRow[] | null;
      if (!embedded) return [];
      return (Array.isArray(embedded) ? embedded : [embedded]).map(titleDTO);
    });
    const inList = new Set(titles.map((title) => title.id));
    const { data: library, error: libraryError } = await db
      .from("titles")
      .select("*")
      .order("added_at", { ascending: false });
    if (libraryError) throw new Error(libraryError.message);
    return apiData({
      list: listDTO(list as ListRow),
      titles,
      candidates: ((library ?? []) as TitleRow[])
        .filter((title) => !inList.has(title.id))
        .map(titleDTO),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/v1/lists/[id]">,
) {
  try {
    const [claims, params, body] = await Promise.all([
      authenticateNativeRequest(request),
      context.params,
      readJsonObject(request),
    ]);
    const patch: Record<string, unknown> = {};
    if (Object.hasOwn(body, "name")) {
      const name = optionalString(body.name, 100);
      if (!name) throw new NativeApiError(400, "bad_request", "Enter a list name.");
      patch.name = name;
      patch.slug = slugify(name);
    }
    if (Object.hasOwn(body, "description")) patch.description = optionalString(body.description, 1_000);
    if (!Object.keys(patch).length) throw new NativeApiError(400, "bad_request", "No list changes were provided.");
    const db = libraryClientForOwner(claims.ownerId);
    const { data, error } = await db
      .from("lists")
      .update(patch)
      .eq("id", params.id)
      .select("*")
      .single();
    if (error || !data) throw new NativeApiError(404, "not_found", "List not found.");
    return apiData(listDTO(data as ListRow));
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext<"/api/v1/lists/[id]">,
) {
  try {
    const [claims, params] = await Promise.all([
      authenticateNativeRequest(request),
      context.params,
    ]);
    const db = libraryClientForOwner(claims.ownerId);
    const { data, error } = await db.from("lists").delete().eq("id", params.id).select("id").single();
    if (error || !data) throw new NativeApiError(404, "not_found", "List not found.");
    return apiData({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
