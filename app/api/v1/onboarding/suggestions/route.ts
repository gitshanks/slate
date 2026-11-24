import { apiData, apiError, NativeApiError, readJsonObject } from "@/lib/native-api/http";
import { authenticateNativeRequest } from "@/lib/native-api/tokens";
import { ONBOARDING_DECK_SIZE, parseOnboardingPicks } from "@/lib/onboarding-recommendations";
import { getOnboardingSuggestions } from "@/lib/onboarding-suggestions";
import { normalizeOnboardingTitle } from "@/lib/onboarding-titles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** "Based on what you liked": titles related to the ones kept in the deck. */
export async function POST(request: Request) {
  try {
    await authenticateNativeRequest(request);
    const body = await readJsonObject(request);
    const kept = parseOnboardingPicks(body.kept);
    const passed = parseOnboardingPicks(body.passed);
    if (!kept || !passed || kept.length + passed.length > ONBOARDING_DECK_SIZE) {
      throw new NativeApiError(400, "bad_request", "Invalid choices.");
    }
    const titles = (await getOnboardingSuggestions(kept, passed)).flatMap((item) => {
      const title = normalizeOnboardingTitle(item);
      return title ? [title] : [];
    });
    return apiData({ titles });
  } catch (error) {
    return apiError(error);
  }
}
