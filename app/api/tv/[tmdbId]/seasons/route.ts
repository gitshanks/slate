import { appApiUnauthorizedResponse } from "@/lib/app-access";
import { getTvSeasons } from "@/lib/tmdb";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tmdbId: string }> },
) {
  const unauthorized = await appApiUnauthorizedResponse();
  if (unauthorized) return unauthorized;

  const { tmdbId: rawTmdbId } = await params;
  const tmdbId = Number(rawTmdbId);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return Response.json({ error: "Invalid title." }, { status: 400 });
  }

  try {
    const seasons = await getTvSeasons(tmdbId);
    return Response.json({ seasons });
  } catch (error) {
    console.error("[tv-seasons] Failed to load seasons", error);
    return Response.json(
      { error: "Seasons are unavailable right now." },
      { status: 500 },
    );
  }
}
