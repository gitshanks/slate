import { addNativeTitle } from "@/lib/native-api/catalog";
import { apiData, apiError, NativeApiError, readJsonObject } from "@/lib/native-api/http";
import { authenticateNativeRequest } from "@/lib/native-api/tokens";
import type { TitleStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const [claims, body] = await Promise.all([
      authenticateNativeRequest(request),
      readJsonObject(request),
    ]);
    const mediaType = body.mediaType;
    if (mediaType !== "movie" && mediaType !== "tv") {
      throw new NativeApiError(400, "bad_request", "Media type is invalid.");
    }
    const tmdbId = Number(body.tmdbId);
    const status = (body.status ?? "want") as TitleStatus;
    return apiData(await addNativeTitle(claims.ownerId, { tmdbId, mediaType, status }));
  } catch (error) {
    return apiError(error);
  }
}
