import { appApiUnauthorizedResponse } from "@/lib/app-access";
import { buildDiscoverSpatialTitleDetail } from "@/lib/discover-spatial-detail";
import { getLibraryOwnerId } from "@/lib/library-db";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ type: string; tmdbId: string }>;
  },
) {
  const unauthorized = await appApiUnauthorizedResponse();
  if (unauthorized) return unauthorized;

  const { type, tmdbId: rawTmdbId } = await params;
  const tmdbId = Number(rawTmdbId);
  if (
    (type !== "movie" && type !== "tv") ||
    !Number.isInteger(tmdbId) ||
    tmdbId <= 0
  ) {
    return Response.json({ error: "Invalid title." }, { status: 400 });
  }

  try {
    const ownerId = await getLibraryOwnerId();
    const detail = await buildDiscoverSpatialTitleDetail(
      ownerId,
      type,
      tmdbId,
    );
    return Response.json(detail, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[discover-title-detail] Failed to load title detail", error);
    return Response.json(
      { error: "Title details are unavailable right now." },
      { status: 500 },
    );
  }
}
