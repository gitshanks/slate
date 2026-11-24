import { runAsLibraryOwner } from "@/lib/library-db";
import { apiData, apiError, NativeApiError } from "@/lib/native-api/http";
import { authenticateNativeRequest } from "@/lib/native-api/tokens";
import { leaveSharedList } from "@/lib/shared-lists";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** Leaves a list someone else shared. */
export async function POST(request: Request, context: Context) {
  try {
    const claims = await authenticateNativeRequest(request);
    const { id } = await context.params;
    await runAsLibraryOwner(claims.ownerId, () => leaveSharedList(id)).catch((error: unknown) => {
      throw new NativeApiError(400, "bad_request", error instanceof Error ? error.message : "Couldn’t leave the list");
    });
    return apiData({ left: true });
  } catch (error) {
    return apiError(error);
  }
}
