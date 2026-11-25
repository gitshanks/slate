import { revalidatePath } from "next/cache";
import { getProfileById } from "@/lib/profiles";
import { saveTopTitleIds } from "@/lib/profile-taste";
import {
  apiData,
  apiError,
  NativeApiError,
  readJsonObject,
} from "@/lib/native-api/http";
import { authenticateNativeRequest } from "@/lib/native-api/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Replace the Top 4 with up to four title ids from the owner's slate, in order. */
export async function PUT(request: Request) {
  try {
    const claims = await authenticateNativeRequest(request);
    const body = await readJsonObject(request);
    if (!Array.isArray(body.ids)) {
      throw new NativeApiError(400, "bad_request", "ids must be a list of title ids.");
    }
    const ids = await saveTopTitleIds(claims.ownerId, body.ids);
    const profile = await getProfileById(claims.ownerId);
    revalidatePath("/profile");
    if (profile) revalidatePath(`/u/${profile.username}`);
    return apiData({ ids });
  } catch (error) {
    return apiError(error);
  }
}
