import { apiData, apiError, NativeApiError, readJsonObject } from "@/lib/native-api/http";
import { authenticateNativeRequest } from "@/lib/native-api/tokens";
import { resolveSharedLink } from "@/lib/shared-link-resolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const [claims, body] = await Promise.all([
      authenticateNativeRequest(request),
      readJsonObject(request),
    ]);
    const input = {
      url: typeof body.url === "string" ? body.url : undefined,
      text: typeof body.text === "string" ? body.text : undefined,
      title: typeof body.title === "string" ? body.title : undefined,
    };
    if (!input.url?.trim() && !input.text?.trim() && !input.title?.trim()) {
      throw new NativeApiError(400, "bad_request", "Share a link or recommendation text first.");
    }
    return apiData(await resolveSharedLink(input, claims.ownerId));
  } catch (error) {
    return apiError(error);
  }
}
