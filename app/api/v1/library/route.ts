import { libraryClientForOwner } from "@/lib/library-db";
import { listDTO, titleDTO } from "@/lib/native-api/dto";
import { apiData, apiError, NativeApiError } from "@/lib/native-api/http";
import { authenticateNativeRequest } from "@/lib/native-api/tokens";
import type { ListRow, TitleRow, TitleStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = new Set<TitleStatus>(["want", "watching", "watched", "dropped"]);

export async function GET(request: Request) {
  try {
    const claims = await authenticateNativeRequest(request);
    const statusParam = new URL(request.url).searchParams.get("status");
    if (statusParam && !STATUSES.has(statusParam as TitleStatus)) {
      throw new NativeApiError(400, "bad_request", "Unknown library status.");
    }

    const db = libraryClientForOwner(claims.ownerId);
    let titlesQuery = db.from("titles").select("*");
    if (statusParam) titlesQuery = titlesQuery.eq("status", statusParam);
    titlesQuery = titlesQuery
      .order("position", { ascending: true })
      .order("added_at", { ascending: false });

    const [{ data: titles, error: titlesError }, { data: lists, error: listsError }] =
      await Promise.all([
        titlesQuery,
        db.from("lists").select("*").order("created_at", { ascending: true }),
      ]);
    if (titlesError) throw new Error(titlesError.message);
    if (listsError) throw new Error(listsError.message);

    return apiData({
      titles: ((titles ?? []) as TitleRow[]).map(titleDTO),
      lists: ((lists ?? []) as ListRow[]).map(listDTO),
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    return apiError(error);
  }
}
