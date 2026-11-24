import { importBatch } from "@/lib/import-actions";
import { runAsLibraryOwner } from "@/lib/library-db";
import { apiData, apiError, NativeApiError, readJsonObject } from "@/lib/native-api/http";
import { authenticateNativeRequest } from "@/lib/native-api/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Matches one batch of parsed rows on TMDB and saves them to the library. */
export async function POST(request: Request) {
  try {
    const claims = await authenticateNativeRequest(request);
    const body = await readJsonObject(request);
    const result = await runAsLibraryOwner(claims.ownerId, () => importBatch(body.rows));
    if (!result.ok) throw new NativeApiError(400, "bad_request", result.error ?? "That batch couldn't be imported.");
    return apiData({ imported: result.imported, unmatched: result.unmatched, titles: result.titles });
  } catch (error) {
    return apiError(error);
  }
}
