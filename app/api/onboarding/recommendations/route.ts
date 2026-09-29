import { appApiUnauthorizedResponse } from "@/lib/app-access";
import { parseOnboardingPicks, selectStarterRecommendations } from "@/lib/onboarding-recommendations";
import { normalizeOnboardingTitle } from "@/lib/onboarding-titles";
import { getRecommendationsFor } from "@/lib/tmdb";

export async function POST(request: Request) {
  const unauthorized = await appApiUnauthorizedResponse();
  if (unauthorized) return unauthorized;
  const raw = await request.text();
  if (raw.length > 4_000) return Response.json({ error: "Too many choices." }, { status: 400 });
  let body;
  try { body = JSON.parse(raw); } catch {
    return Response.json({ error: "Invalid choices." }, { status: 400 });
  }
  const kept = parseOnboardingPicks(body?.kept);
  const passed = parseOnboardingPicks(body?.passed);
  if (!kept || !passed || kept.length + passed.length > 10) {
    return Response.json({ error: "Invalid choices." }, { status: 400 });
  }
  const catalogues = kept.length && kept.length < 10
    ? await Promise.all(kept.map((pick) => getRecommendationsFor(pick.mediaType, pick.tmdbId)))
    : [];
  const titles = selectStarterRecommendations(catalogues, kept, passed)
    .flatMap((item) => {
      const title = normalizeOnboardingTitle(item);
      return title ? [title] : [];
    });
  return Response.json({ titles }, { headers: { "Cache-Control": "private, no-store" } });
}
