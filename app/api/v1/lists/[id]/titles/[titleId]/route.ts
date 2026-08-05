import { libraryClientForOwner } from "@/lib/library-db";
import { apiData, apiError, NativeApiError } from "@/lib/native-api/http";
import { authenticateNativeRequest } from "@/lib/native-api/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/v1/lists/[id]/titles/[titleId]">;

export async function POST(request: Request, context: Context) {
  try {
    const [claims, params] = await Promise.all([
      authenticateNativeRequest(request),
      context.params,
    ]);
    const db = libraryClientForOwner(claims.ownerId);
    const [{ data: list }, { data: title }] = await Promise.all([
      db.from("lists").select("id").eq("id", params.id).maybeSingle(),
      db.from("titles").select("id").eq("id", params.titleId).maybeSingle(),
    ]);
    if (!list || !title) throw new NativeApiError(404, "not_found", "List or title not found.");
    const { data: positions } = await db
      .from("list_titles")
      .select("position")
      .eq("list_id", params.id)
      .order("position", { ascending: false })
      .limit(1);
    const last = Number(positions?.[0]?.position);
    const { error } = await db.from("list_titles").insert({
      list_id: params.id,
      title_id: params.titleId,
      position: Number.isFinite(last) ? last + 1 : 0,
    });
    if (error && !error.message.toLowerCase().includes("duplicate")) throw new Error(error.message);
    return apiData({ added: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const [claims, params] = await Promise.all([
      authenticateNativeRequest(request),
      context.params,
    ]);
    const db = libraryClientForOwner(claims.ownerId);
    const { error } = await db
      .from("list_titles")
      .delete()
      .eq("list_id", params.id)
      .eq("title_id", params.titleId);
    if (error) throw new Error(error.message);
    return apiData({ removed: true });
  } catch (error) {
    return apiError(error);
  }
}
