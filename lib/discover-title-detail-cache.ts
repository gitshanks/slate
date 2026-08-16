import type { PublicSpatialTitleDetail } from "@/lib/public-spatial-detail-types";
import type { PublicSpatialSavedTitle } from "@/lib/public-spatial-detail-types";
import type { TitleRow } from "@/lib/types";

const details = new Map<string, PublicSpatialTitleDetail>();
const pending = new Map<string, Promise<PublicSpatialTitleDetail>>();
let cacheGeneration = 0;

function keyFor(title: Pick<TitleRow, "media_type" | "tmdb_id">) {
  return `${title.media_type}:${title.tmdb_id}`;
}

export function getCachedDiscoverTitleDetail(
  title: Pick<TitleRow, "media_type" | "tmdb_id">,
) {
  return details.get(keyFor(title)) ?? null;
}

export function updateCachedDiscoverTitleSavedTitle(
  title: Pick<TitleRow, "media_type" | "tmdb_id">,
  savedTitle: PublicSpatialSavedTitle,
) {
  const key = keyFor(title);
  const cached = details.get(key);
  if (!cached) return;

  details.set(key, {
    ...cached,
    savedTitle,
    resolvedTitle: cached.resolvedTitle
      ? {
          ...cached.resolvedTitle,
          id: savedTitle.id,
          status: savedTitle.status,
        }
      : cached.resolvedTitle,
  });
}

export function clearDiscoverTitleDetailCache() {
  cacheGeneration += 1;
  details.clear();
  pending.clear();
}

/**
 * Share one in-flight catalogue request across repeated cards and keep a title
 * instant when it is reopened later in the same Discover session.
 */
export function loadDiscoverTitleDetail(
  title: Pick<TitleRow, "media_type" | "tmdb_id">,
) {
  const key = keyFor(title);
  const generation = cacheGeneration;
  const cached = details.get(key);
  if (cached) return Promise.resolve(cached);

  const inFlight = pending.get(key);
  if (inFlight) return inFlight;

  const request = fetch(
    `/api/discover/titles/${title.media_type}/${title.tmdb_id}`,
    { cache: "no-store" },
  )
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("Title details are unavailable right now.");
      }
      return (await response.json()) as PublicSpatialTitleDetail;
    })
    .then((detail) => {
      if (generation === cacheGeneration) details.set(key, detail);
      return detail;
    })
    .finally(() => {
      if (pending.get(key) === request) pending.delete(key);
    });

  pending.set(key, request);
  return request;
}
