import { searchNativeCatalogue } from "@/lib/native-api/catalog";
import { apiData, apiError, NativeApiError } from "@/lib/native-api/http";
import { authenticateNativeRequest } from "@/lib/native-api/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const claims = await authenticateNativeRequest(request);
    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    if (!query || query.length > 200) {
      throw new NativeApiError(400, "bad_request", "Enter a title or person to search.");
    }
    return apiData(await searchNativeCatalogue(claims.ownerId, query));
  } catch (error) {
    return apiError(error);
  }
}
