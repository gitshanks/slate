import { libraryClientForOwner } from "@/lib/library-db";
import { listDTO, titleDTO } from "@/lib/native-api/dto";
import { apiData, apiError, NativeApiError } from "@/lib/native-api/http";
import { authenticateNativeRequest } from "@/lib/native-api/tokens";
import type { TitleRow, TitleStatus } from "@/lib/types";
import { getAccessibleListsForOwner, getListTitles } from "@/lib/shared-lists";
import { getTvHiddenListIds } from "@/lib/list-tv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = new Set<TitleStatus>(["want", "watching", "watched", "dropped"]);

export async function GET(request: Request) {
  try {
    const claims = await authenticateNativeRequest(request);
    const params = new URL(request.url).searchParams;
    const statusParam = params.get("status");
    // A TV asks for each list's titles with the library, so its list rails
    // stay as fresh as Up Next without a request of their own.
    const withListTitles = params.get("listTitles") === "1";
    if (statusParam && !STATUSES.has(statusParam as TitleStatus)) {
      throw new NativeApiError(400, "bad_request", "Unknown library status.");
    }

    const db = libraryClientForOwner(claims.ownerId);
    let titlesQuery = db.from("titles").select("*");
    if (statusParam) titlesQuery = titlesQuery.eq("status", statusParam);
    titlesQuery = titlesQuery
      .order("position", { ascending: true })
      .order("added_at", { ascending: false });

    const [{ data: titles, error: titlesError }, lists] =
      await Promise.all([
        titlesQuery,
        getAccessibleListsForOwner(claims.ownerId),
      ]);
    if (titlesError) throw new Error(titlesError.message);
    const hiddenOnTv = withListTitles
      ? await getTvHiddenListIds(claims.ownerId).catch(() => new Set<string>())
      : new Set<string>();

    return apiData({
      titles: ((titles ?? []) as TitleRow[]).map(titleDTO),
      // The TV gets only the lists you've left on for it.
      lists: withListTitles
        ? await Promise.all(
            lists.filter((list) => !hiddenOnTv.has(list.id)).map(async (list) => ({
              ...listDTO(list),
              titles: (await getListTitles(list)).map(titleDTO),
            })),
          )
        : lists.map(listDTO),
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    return apiError(error);
  }
}
