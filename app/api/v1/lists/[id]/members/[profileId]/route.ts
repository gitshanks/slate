import { runAsLibraryOwner } from "@/lib/library-db";
import { apiData, apiError, NativeApiError } from "@/lib/native-api/http";
import { authenticateNativeRequest } from "@/lib/native-api/tokens";
import { removeListMember } from "@/lib/shared-lists";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string; profileId: string }> };

/** The list's owner takes someone off it. */
export async function DELETE(request: Request, context: Context) {
  try {
    const claims = await authenticateNativeRequest(request);
    const { id, profileId } = await context.params;
    await runAsLibraryOwner(claims.ownerId, () => removeListMember(id, profileId)).catch((error: unknown) => {
      throw new NativeApiError(400, "bad_request", error instanceof Error ? error.message : "Couldn’t update access");
    });
    return apiData({ removed: true });
  } catch (error) {
    return apiError(error);
  }
}
