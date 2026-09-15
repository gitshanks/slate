import type { PublicSpatialTitleDetail } from "@/lib/public-spatial-detail-types";
import type { TitleRow } from "@/lib/types";

// Keep catalogue responses separate from Discover's account-aware cache.
const details = new Map<string, PublicSpatialTitleDetail>();
const pending = new Map<string, Promise<PublicSpatialTitleDetail>>();
let generation = 0;

function keyFor(title: Pick<TitleRow, "media_type" | "tmdb_id">) {
  return `${title.media_type}:${title.tmdb_id}`;
}

export function getCachedPublicCatalogueDetail(
  title: Pick<TitleRow, "media_type" | "tmdb_id">,
) {
  return details.get(keyFor(title)) ?? null;
}

export function clearPublicCatalogueDetailCache() {
  generation += 1;
  details.clear();
  pending.clear();
}

export function loadPublicCatalogueDetail(
  title: Pick<TitleRow, "media_type" | "tmdb_id">,
) {
  const key = keyFor(title);
  const requestGeneration = generation;
  const cached = details.get(key);
  if (cached) return Promise.resolve(cached);
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;

  const request = fetch(
    `/api/public/catalogue/${title.media_type}/${title.tmdb_id}`,
  )
    .then(async (response) => {
      if (!response.ok)
        throw new Error("Title details are unavailable right now.");
      return (await response.json()) as PublicSpatialTitleDetail;
    })
    .then((detail) => {
      if (requestGeneration === generation) details.set(key, detail);
      return detail;
    })
    .finally(() => {
      if (pending.get(key) === request) pending.delete(key);
    });
  pending.set(key, request);
  return request;
}
