import { aiSearchEnabled, suggestQueries } from "@/lib/ai-search";
import { apiData, apiError } from "@/lib/native-api/http";
import { authenticateNativeRequest } from "@/lib/native-api/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Live AI query suggestions for a partly typed search, like /api/ai-suggest. */
export async function GET(request: Request) {
  try {
    await authenticateNativeRequest(request);
    const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    if (!aiSearchEnabled || q.length < 2 || q.length > 200) {
      return apiData({ suggestions: [] });
    }
    return apiData({ suggestions: await suggestQueries(q) });
  } catch (error) {
    return apiError(error);
  }
}
