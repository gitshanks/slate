import "server-only";
import { getRecommendationsFor, getSimilarFor } from "@/lib/tmdb";
import { ONBOARDING_SUGGESTION_COUNT, selectStarterRecommendations, type OnboardingPick } from "@/lib/onboarding-recommendations";

export async function getOnboardingSuggestions(kept: OnboardingPick[], passed: OnboardingPick[]) {
  if (!kept.length) return [];
  const catalogues = await Promise.all(kept.map((pick) => getRecommendationsFor(pick.mediaType, pick.tmdbId)));
  let selected = selectStarterRecommendations(catalogues, kept, passed);

  // Reuse the shared 24-hour catalogue cache. Expand only when the first
  // pages are short, with at most three seeds for each extra lookup round.
  const seeds = kept.slice(0, 3);
  if (selected.length < ONBOARDING_SUGGESTION_COUNT) {
    const extra = await Promise.all(seeds.map((pick) => getRecommendationsFor(pick.mediaType, pick.tmdbId, 2)));
    extra.forEach((items, index) => catalogues[index].push(...items));
    selected = selectStarterRecommendations(catalogues, kept, passed);
  }
  for (let page = 1; page <= 2 && selected.length < ONBOARDING_SUGGESTION_COUNT; page++) {
    const similar = await Promise.all(seeds.map((pick) => getSimilarFor(pick.mediaType, pick.tmdbId, page)));
    similar.forEach((items, index) => catalogues[index].push(...items));
    selected = selectStarterRecommendations(catalogues, kept, passed);
  }
  return selected;
}
