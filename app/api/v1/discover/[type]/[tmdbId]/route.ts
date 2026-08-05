import { getNativeDiscoverDetail } from "@/lib/native-api/catalog";
import { apiData, apiError, NativeApiError } from "@/lib/native-api/http";
import { authenticateNativeRequest } from "@/lib/native-api/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: RouteContext<"/api/v1/discover/[type]/[tmdbId]">,
) {
  try {
    const [claims, params] = await Promise.all([
      authenticateNativeRequest(request),
      context.params,
    ]);
    if (params.type !== "movie" && params.type !== "tv") {
      throw new NativeApiError(400, "bad_request", "Media type is invalid.");
    }
    const tmdbId = Number(params.tmdbId);
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
      throw new NativeApiError(400, "bad_request", "Title id is invalid.");
    }
    return apiData(await getNativeDiscoverDetail(claims.ownerId, params.type, tmdbId));
  } catch (error) {
    return apiError(error);
  }
}
