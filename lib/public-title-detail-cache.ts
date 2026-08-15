import type { PublicSpatialTitleDetail } from "@/lib/public-spatial-detail-types";

const details = new Map<string, PublicSpatialTitleDetail>();
const pending = new Map<string, Promise<PublicSpatialTitleDetail>>();

function detailKey(username: string, titleId: string) {
  return `${username}:${titleId}`;
}

export function getCachedPublicTitleDetail(username: string, titleId: string) {
  return details.get(detailKey(username, titleId)) ?? null;
}

/**
 * Share title-detail work between Shelf and Space. It lets either surface
 * begin the request at press time and lets subsequent openings render from
 * memory without another network round trip.
 */
export function loadPublicTitleDetail(username: string, titleId: string) {
  const key = detailKey(username, titleId);
  const cached = details.get(key);
  if (cached) return Promise.resolve(cached);

  const inFlight = pending.get(key);
  if (inFlight) return inFlight;

  const request = fetch(
    `/api/public/${encodeURIComponent(username)}/titles/${encodeURIComponent(titleId)}`,
    { cache: "no-store" },
  )
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("Title details are unavailable right now.");
      }
      return (await response.json()) as PublicSpatialTitleDetail;
    })
    .then((detail) => {
      details.set(key, detail);
      return detail;
    })
    .finally(() => {
      pending.delete(key);
    });

  pending.set(key, request);
  return request;
}
