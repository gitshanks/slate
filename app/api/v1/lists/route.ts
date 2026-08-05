import { libraryClientForOwner } from "@/lib/library-db";
import { listDTO } from "@/lib/native-api/dto";
import { apiData, apiError, NativeApiError, optionalString, readJsonObject } from "@/lib/native-api/http";
import { authenticateNativeRequest } from "@/lib/native-api/tokens";
import type { ListRow } from "@/lib/types";
import { slugify } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const claims = await authenticateNativeRequest(request);
    const db = libraryClientForOwner(claims.ownerId);
    const { data: lists, error } = await db
      .from("lists")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (lists ?? []).map((list) => String(list.id));
    const summaries = new Map<string, { count: number; posterPaths: string[] }>();
    if (ids.length) {
      const { data: rows, error: rowsError } = await db
        .from("list_titles")
        .select("list_id, position, titles(poster_path)")
        .in("list_id", ids)
        .order("position", { ascending: true });
      if (rowsError) throw new Error(rowsError.message);
      for (const row of rows ?? []) {
        const id = String(row.list_id);
        const summary = summaries.get(id) ?? { count: 0, posterPaths: [] };
        summary.count += 1;
        const embedded = row.titles as unknown as
          | { poster_path?: string | null }
          | { poster_path?: string | null }[]
          | null;
        const poster = Array.isArray(embedded) ? embedded[0]?.poster_path : embedded?.poster_path;
        if (poster && summary.posterPaths.length < 4) summary.posterPaths.push(poster);
        summaries.set(id, summary);
      }
    }
    return apiData({
      lists: ((lists ?? []) as ListRow[]).map((list) => ({
        ...listDTO(list),
        count: summaries.get(list.id)?.count ?? 0,
        posterPaths: summaries.get(list.id)?.posterPaths ?? [],
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const [claims, body] = await Promise.all([
      authenticateNativeRequest(request),
      readJsonObject(request),
    ]);
    const name = optionalString(body.name, 100);
    const description = optionalString(body.description, 1_000);
    if (!name) throw new NativeApiError(400, "bad_request", "Enter a list name.");
    const db = libraryClientForOwner(claims.ownerId);
    const { data, error } = await db
      .from("lists")
      .insert({ name, slug: slugify(name), description })
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message || "List could not be created.");
    return apiData({ ...listDTO(data as ListRow), count: 0, posterPaths: [] });
  } catch (error) {
    return apiError(error);
  }
}
