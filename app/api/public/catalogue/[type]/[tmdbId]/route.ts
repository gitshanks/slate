import { buildPublicCatalogueDetail } from "@/lib/public-catalogue-detail";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ type: string; tmdbId: string }> },
) {
  const { type, tmdbId: rawTmdbId } = await params;
  if (
    (type !== "movie" && type !== "tv") ||
    !/^[1-9]\d{0,9}$/.test(rawTmdbId)
  ) {
    return Response.json({ error: "Invalid title." }, { status: 400 });
  }

  try {
    const detail = await buildPublicCatalogueDetail(type, Number(rawTmdbId));
    return Response.json(detail, {
      headers: {
        "Cache-Control":
          "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return Response.json(
      { error: "Title details are unavailable right now." },
      { status: 503 },
    );
  }
}
