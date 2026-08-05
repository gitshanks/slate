import { libraryClientForOwner } from "@/lib/library-db";
import { listDTO } from "@/lib/native-api/dto";
import {
  apiData,
  apiError,
  NativeApiError,
  optionalString,
  readJsonObject,
} from "@/lib/native-api/http";
import { authenticateNativeRequest } from "@/lib/native-api/tokens";
import type { ListRow } from "@/lib/types";
import { slugify } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: RouteContext<"/api/v1/titles/[id]/lists">,
) {
  try {
    const [claims, params, body] = await Promise.all([
      authenticateNativeRequest(request),
      context.params,
      readJsonObject(request),
    ]);
    const titleId = params.id;
    const requestedListId = optionalString(body.listId, 100);
    const requestedName = optionalString(body.name, 100);
    if (!titleId || (!requestedListId && !requestedName)) {
      throw new NativeApiError(400, "bad_request", "Choose a list or enter a list name.");
    }

    const db = libraryClientForOwner(claims.ownerId);
    const { data: title, error: titleError } = await db
      .from("titles")
      .select("id")
      .eq("id", titleId)
      .maybeSingle();
    if (titleError || !title) {
      throw new NativeApiError(404, "not_found", "This title is not in your library.");
    }

    let list: ListRow;
    if (requestedListId) {
      const { data, error } = await db
        .from("lists")
        .select("*")
        .eq("id", requestedListId)
        .maybeSingle();
      if (error || !data) {
        throw new NativeApiError(404, "not_found", "That list could not be found.");
      }
      list = data as ListRow;
    } else {
      const name = requestedName!;
      const { data, error } = await db
        .from("lists")
        .insert({ name, slug: slugify(name), description: null })
        .select("*")
        .single();
      if (error || !data) throw new Error(error?.message || "List could not be created.");
      list = data as ListRow;
    }

    const { data: lastRows, error: positionError } = await db
      .from("list_titles")
      .select("position")
      .eq("list_id", list.id)
      .order("position", { ascending: false })
      .limit(1);
    if (positionError) throw new Error(positionError.message);
    const lastPosition = Number(lastRows?.[0]?.position);
    const { error: linkError } = await db.from("list_titles").insert({
      list_id: list.id,
      title_id: titleId,
      position: Number.isFinite(lastPosition) ? lastPosition + 1 : 0,
    });
    if (linkError && !linkError.message.toLowerCase().includes("duplicate")) {
      throw new Error(linkError.message);
    }

    return apiData({ ...listDTO(list), containsTitle: true });
  } catch (error) {
    return apiError(error);
  }
}
