import { libraryClientForOwner } from "@/lib/library-db";
import { titleDTO } from "@/lib/native-api/dto";
import {
  apiData,
  apiError,
  NativeApiError,
  readJsonObject,
} from "@/lib/native-api/http";
import { getNativeTitleDetail } from "@/lib/native-api/title-detail";
import { authenticateNativeRequest } from "@/lib/native-api/tokens";
import type { TitleRow, TitleStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EDITABLE_STATUSES = new Set<TitleStatus>(["want", "watching", "watched"]);

async function routeTitleId(context: RouteContext<"/api/v1/titles/[id]">) {
  const { id } = await context.params;
  if (!id || id.length > 100) {
    throw new NativeApiError(400, "bad_request", "title id is invalid.");
  }
  return id;
}

async function nextStatusPosition(
  ownerId: string,
  status: TitleStatus,
): Promise<number> {
  const db = libraryClientForOwner(ownerId);
  const { data, error } = await db
    .from("titles")
    .select("position")
    .eq("status", status)
    .order("position", { ascending: true })
    .limit(1);
  if (error) throw new Error(error.message);
  const current = Number(data?.[0]?.position);
  return Number.isFinite(current) ? current - 1 : 0;
}

export async function GET(
  request: Request,
  context: RouteContext<"/api/v1/titles/[id]">,
) {
  try {
    const [claims, titleId] = await Promise.all([
      authenticateNativeRequest(request),
      routeTitleId(context),
    ]);
    return apiData(await getNativeTitleDetail(claims.ownerId, titleId));
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/v1/titles/[id]">,
) {
  try {
    const [claims, titleId, body] = await Promise.all([
      authenticateNativeRequest(request),
      routeTitleId(context),
      readJsonObject(request),
    ]);
    const patch: Record<string, unknown> = {};

    if (Object.hasOwn(body, "status")) {
      const status = body.status as TitleStatus;
      if (!EDITABLE_STATUSES.has(status)) {
        throw new NativeApiError(400, "bad_request", "status is invalid.");
      }
      patch.status = status;
      patch.position = await nextStatusPosition(claims.ownerId, status);
      patch.watched_at = status === "watched" ? new Date().toISOString() : null;
    }

    if (Object.hasOwn(body, "rating")) {
      const rating = body.rating;
      if (rating !== null && rating !== 1 && rating !== 2 && rating !== 3) {
        throw new NativeApiError(400, "bad_request", "rating is invalid.");
      }
      patch.rating = rating;
    }

    if (Object.hasOwn(body, "review")) {
      if (typeof body.review !== "string" || body.review.length > 10_000) {
        throw new NativeApiError(400, "bad_request", "review is invalid.");
      }
      patch.review = body.review.trim() || null;
    }

    if (Object.hasOwn(body, "favorite")) {
      if (typeof body.favorite !== "boolean") {
        throw new NativeApiError(400, "bad_request", "favorite is invalid.");
      }
      patch.favorite = body.favorite;
    }

    if (!Object.keys(patch).length) {
      throw new NativeApiError(400, "bad_request", "No title changes were provided.");
    }

    const db = libraryClientForOwner(claims.ownerId);
    const { data, error } = await db
      .from("titles")
      .update(patch)
      .eq("id", titleId)
      .select("*")
      .single();
    if (error || !data) {
      throw new NativeApiError(404, "not_found", "This title is not in your library.");
    }
    return apiData(titleDTO(data as TitleRow));
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext<"/api/v1/titles/[id]">,
) {
  try {
    const [claims, titleId] = await Promise.all([
      authenticateNativeRequest(request),
      routeTitleId(context),
    ]);
    const db = libraryClientForOwner(claims.ownerId);
    const { data, error } = await db
      .from("titles")
      .delete()
      .eq("id", titleId)
      .select("id")
      .single();
    if (error || !data) {
      throw new NativeApiError(404, "not_found", "This title is not in your library.");
    }
    return apiData({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
