import { getNativePerson } from "@/lib/native-api/catalog";
import { apiData, apiError, NativeApiError } from "@/lib/native-api/http";
import { authenticateNativeRequest } from "@/lib/native-api/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: RouteContext<"/api/v1/people/[id]">,
) {
  try {
    const [, params] = await Promise.all([
      authenticateNativeRequest(request),
      context.params,
    ]);
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new NativeApiError(400, "bad_request", "Person id is invalid.");
    }
    return apiData(await getNativePerson(id));
  } catch (error) {
    return apiError(error);
  }
}
