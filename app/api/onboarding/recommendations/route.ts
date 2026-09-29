import { appApiUnauthorizedResponse } from "@/lib/app-access";
import { ONBOARDING_DECK_SIZE, parseOnboardingPicks } from "@/lib/onboarding-recommendations";
import { normalizeOnboardingTitle } from "@/lib/onboarding-titles";
import { getOnboardingSuggestions } from "@/lib/onboarding-suggestions";

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
  if (!kept || !passed || kept.length + passed.length > ONBOARDING_DECK_SIZE) {
    return Response.json({ error: "Invalid choices." }, { status: 400 });
  }
  const titles = (await getOnboardingSuggestions(kept, passed))
    .flatMap((item) => {
      const title = normalizeOnboardingTitle(item);
      return title ? [title] : [];
    });
  return Response.json({ titles }, { headers: { "Cache-Control": "private, no-store" } });
}
