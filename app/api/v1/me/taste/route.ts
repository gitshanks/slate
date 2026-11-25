import { getProfileTaste } from "@/lib/profile-taste";
import { apiData, apiError, NativeApiError } from "@/lib/native-api/http";
import { authenticateNativeRequest } from "@/lib/native-api/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The numbers on the profile: Top 4, hours, shelves, now and taste. */
export async function GET(request: Request) {
  try {
    const claims = await authenticateNativeRequest(request);
    const taste = await getProfileTaste(claims.ownerId);
    if (!taste) {
      throw new NativeApiError(500, "internal_error", "Your profile couldn't be read.");
    }
    return apiData(taste);
  } catch (error) {
    return apiError(error);
  }
}
