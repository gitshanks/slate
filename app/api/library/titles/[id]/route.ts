import { appApiUnauthorizedResponse } from "@/lib/app-access";
import { getLibraryClient } from "@/lib/library-db";
import { buildSpatialTitleDetail } from "@/lib/spatial-title-detail";
import type { TitleRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await appApiUnauthorizedResponse();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  if (!id || id.length > 128) {
    return Response.json({ error: "Invalid title." }, { status: 400 });
  }

  try {
    // getLibraryClient applies the current account's immutable owner predicate,
    // so a guessed id can never resolve a title from another library.
    const db = await getLibraryClient();
    const { data, error } = await db
      .from("titles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) {
      return Response.json({ error: "Title not found." }, { status: 404 });
    }

    const detail = await buildSpatialTitleDetail(data as TitleRow);
    return Response.json(detail, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[library-title-detail] Failed to load title detail", error);
    return Response.json(
      { error: "Title details are unavailable right now." },
      { status: 500 },
    );
  }
}
