import { runAsLibraryOwner } from "@/lib/library-db";
import { apiData, apiError, NativeApiError } from "@/lib/native-api/http";
import { authenticateNativeRequest } from "@/lib/native-api/tokens";
import { createListInvite } from "@/lib/shared-lists";
import { siteOrigin } from "@/lib/site-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/**
 * A fresh invite link for a list, as the web's Share list makes: anyone who
 * opens it can join and add, remove and arrange its titles. It replaces the
 * list's previous link and lasts 30 days.
 */
export async function POST(request: Request, context: Context) {
  try {
    const claims = await authenticateNativeRequest(request);
    const { id } = await context.params;
    const invite = await runAsLibraryOwner(claims.ownerId, () => createListInvite(id)).catch((error: unknown) => {
      throw new NativeApiError(400, "bad_request", error instanceof Error ? error.message : "Couldn’t create an invite");
    });
    return apiData({ url: `${siteOrigin()}/join/${invite.token}`, expiresAt: invite.expiresAt });
  } catch (error) {
    return apiError(error);
  }
}
