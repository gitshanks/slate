import type { TitleRow } from "@/lib/types";

export type ShareableTitle = Pick<TitleRow, "tmdb_id" | "media_type" | "title" | "poster_path" | "backdrop_path" | "release_date">;

export function parseSharedTitle(type: unknown, id: unknown): { mediaType: "movie" | "tv"; tmdbId: number } | null {
  if ((type !== "movie" && type !== "tv") || !/^[1-9]\d{0,9}$/.test(String(id))) return null;
  return { mediaType: type, tmdbId: Number(id) };
}

export function titleSharePath(type: "movie" | "tv", id: number) {
  if (!parseSharedTitle(type, id)) throw new Error("Invalid title.");
  return `/t/${type}/${id}`;
}

/** Only catalogue links can carry a recommendation through onboarding. */
export function sharedTitleFromPath(value: unknown) {
  if (typeof value !== "string") return null;
  const match = /^\/t\/(movie|tv)\/([1-9]\d{0,9})$/.exec(value);
  return match ? parseSharedTitle(match[1], match[2]) : null;
}

export function sharedTitleOnboardingPath(type: "movie" | "tv", id: number) {
  return `/onboarding?${new URLSearchParams({ next: titleSharePath(type, id) })}`;
}

export function sharedTitleLoginPath(type: "movie" | "tv", id: number) {
  return `/login?${new URLSearchParams({ mode: "create", next: sharedTitleOnboardingPath(type, id) })}`;
}
