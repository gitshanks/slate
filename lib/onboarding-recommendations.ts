import type { TmdbSearchResult } from "@/lib/tmdb";

export interface OnboardingPick {
  tmdbId: number;
  mediaType: "movie" | "tv";
}

export const ONBOARDING_DECK_SIZE = 10;
export const ONBOARDING_SUGGESTION_COUNT = 40;
export const MAX_ONBOARDING_SELECTIONS = ONBOARDING_DECK_SIZE + ONBOARDING_SUGGESTION_COUNT;

export function titleKey(title: OnboardingPick) {
  return `${title.mediaType}:${title.tmdbId}`;
}

export function parseOnboardingPicks(value: unknown, limit = ONBOARDING_DECK_SIZE): OnboardingPick[] | null {
  if (!Array.isArray(value) || value.length > limit) return null;
  const picks: OnboardingPick[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    if (!Number.isSafeInteger(item.tmdbId) || item.tmdbId <= 0 || item.tmdbId > 9_999_999_999) return null;
    if (item.mediaType !== "movie" && item.mediaType !== "tv") return null;
    const key = titleKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    picks.push({ tmdbId: item.tmdbId, mediaType: item.mediaType });
  }
  return picks;
}

/** Round-robin related catalogues so one liked title cannot fill the shelf. */
export function selectStarterRecommendations(
  catalogues: TmdbSearchResult[][],
  kept: OnboardingPick[],
  passed: OnboardingPick[],
) {
  if (!kept.length) return [];
  const excluded = new Set([...kept, ...passed].map(titleKey));
  const result: TmdbSearchResult[] = [];
  const longest = Math.max(0, ...catalogues.map((catalogue) => catalogue.length));
  for (let index = 0; index < longest && result.length < ONBOARDING_SUGGESTION_COUNT; index += 1) {
    for (const catalogue of catalogues) {
      const item = catalogue[index];
      if (!item || (item.media_type !== "movie" && item.media_type !== "tv")) continue;
      if (!item.poster_path || !item.backdrop_path || !item.overview?.trim()) continue;
      if (!item.title && !item.name) continue;
      const key = titleKey({ tmdbId: item.id, mediaType: item.media_type });
      if (excluded.has(key)) continue;
      excluded.add(key);
      result.push(item);
      if (result.length === ONBOARDING_SUGGESTION_COUNT) break;
    }
  }
  return result;
}
