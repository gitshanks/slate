import { libraryClientForOwner } from "@/lib/library-db";
import { listDTO, titleDTO } from "@/lib/native-api/dto";
import { apiData, apiError, NativeApiError, optionalString, readJsonObject } from "@/lib/native-api/http";
import { authenticateNativeRequest } from "@/lib/native-api/tokens";
import type { ListRow, TitleRow } from "@/lib/types";
import { slugify } from "@/lib/utils";
import { getListTitles, requireListAccessForOwner } from "@/lib/shared-lists";
import { supabase } from "@/lib/supabase";

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
    const list = await requireListAccessForOwner(claims.ownerId, params.id)
      .catch(() => { throw new NativeApiError(404, "not_found", "List not found."); });
    const titles = (await getListTitles(list)).map(titleDTO);
    const inList = new Set(titles.map((title) => title.id));
    const { data: library, error: libraryError } = await db
      .from("titles")
      .select("*")
      .order("added_at", { ascending: false });
    if (libraryError) throw new Error(libraryError.message);
    return apiData({
      list: listDTO(list),
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
    await requireListAccessForOwner(claims.ownerId, params.id, true)
      .catch(() => { throw new NativeApiError(404, "not_found", "List not found."); });
    const { data, error } = await supabase
      .from("lists")
      .update(patch)
      .eq("id", params.id)
      .eq("owner_id", claims.ownerId)
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
    await requireListAccessForOwner(claims.ownerId, params.id, true)
      .catch(() => { throw new NativeApiError(404, "not_found", "List not found."); });
    const { data, error } = await supabase.from("lists").delete().eq("id", params.id).eq("owner_id", claims.ownerId).select("id").single();
    if (error || !data) throw new NativeApiError(404, "not_found", "List not found.");
    return apiData({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
