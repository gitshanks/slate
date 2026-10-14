import { appApiUnauthorizedResponse } from "@/lib/app-access";
import { getTvSeasonEpisodes } from "@/lib/tmdb";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tmdbId: string; season: string }> },
) {
  const unauthorized = await appApiUnauthorizedResponse();
  if (unauthorized) return unauthorized;

  const { tmdbId: rawTmdbId, season: rawSeason } = await params;
  const tmdbId = Number(rawTmdbId);
  const season = Number(rawSeason);
  if (
    !Number.isInteger(tmdbId) ||
    tmdbId <= 0 ||
    !Number.isInteger(season) ||
    season < 0
  ) {
    return Response.json({ error: "Invalid season." }, { status: 400 });
  }

  try {
    const episodes = await getTvSeasonEpisodes(tmdbId, season);
    return Response.json({ episodes });
  } catch (error) {
    console.error("[tv-season] Failed to load episodes", error);
    return Response.json(
      { error: "Episodes are unavailable right now." },
      { status: 500 },
    );
  }
}
