import { libraryClientForOwner } from "@/lib/library-db";
import { apiData, apiError, NativeApiError, readJsonObject } from "@/lib/native-api/http";
import { authenticateNativeRequest } from "@/lib/native-api/tokens";
import type { TitleStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = new Set<TitleStatus>(["want", "watching", "watched"]);

function titleIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 5_000) {
    throw new NativeApiError(400, "bad_request", "Title order is invalid.");
  }
  const ids = value.filter((id): id is string => typeof id === "string" && id.length > 0);
  if (ids.length !== value.length || new Set(ids).size !== ids.length) {
    throw new NativeApiError(400, "bad_request", "Title order is invalid.");
  }
  return ids;
}

function sameIds(actual: string[], ordered: string[]) {
  const set = new Set(actual);
  return actual.length === ordered.length && ordered.every((id) => set.has(id));
}

export async function PATCH(request: Request) {
  try {
    const [claims, body] = await Promise.all([
      authenticateNativeRequest(request),
      readJsonObject(request),
    ]);
    const orderedIds = titleIds(body.titleIds);
    const db = libraryClientForOwner(claims.ownerId);

    if (body.kind === "status") {
      const status = body.status as TitleStatus;
      if (!STATUSES.has(status)) {
        throw new NativeApiError(400, "bad_request", "Collection is invalid.");
      }
      const { data, error } = await db.from("titles").select("id").eq("status", status);
      if (error) throw new Error(error.message);
      const actual = (data ?? []).map((row) => String(row.id));
      if (!sameIds(actual, orderedIds)) {
        throw new NativeApiError(409, "conflict", "This collection changed. Refresh and try again.");
      }
      const results = await Promise.all(
        orderedIds.map((id, position) => db.from("titles").update({ position }).eq("id", id)),
      );
      const failed = results.find((result) => result.error)?.error;
      if (failed) throw new Error(failed.message);
      return apiData({ reordered: true });
    }

    if (body.kind === "list") {
      if (typeof body.listId !== "string" || !body.listId) {
        throw new NativeApiError(400, "bad_request", "List is invalid.");
      }
      const { data: list } = await db.from("lists").select("id").eq("id", body.listId).maybeSingle();
      if (!list) throw new NativeApiError(404, "not_found", "List not found.");
      const { data, error } = await db
        .from("list_titles")
        .select("title_id")
        .eq("list_id", body.listId);
      if (error) throw new Error(error.message);
      const actual = (data ?? []).map((row) => String(row.title_id));
      if (!sameIds(actual, orderedIds)) {
        throw new NativeApiError(409, "conflict", "This list changed. Refresh and try again.");
      }
      const results = await Promise.all(
        orderedIds.map((id, position) =>
          db.from("list_titles").update({ position }).eq("list_id", body.listId).eq("title_id", id)
        ),
      );
      const failed = results.find((result) => result.error)?.error;
      if (failed) throw new Error(failed.message);
      return apiData({ reordered: true });
    }

    throw new NativeApiError(400, "bad_request", "Reorder target is invalid.");
  } catch (error) {
    return apiError(error);
  }
}
