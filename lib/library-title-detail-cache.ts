import type { PublicSpatialTitleDetail } from "@/lib/public-spatial-detail-types";

const details = new Map<string, PublicSpatialTitleDetail>();
const pending = new Map<string, Promise<PublicSpatialTitleDetail>>();

export function getCachedLibraryTitleDetail(titleId: string) {
  return details.get(titleId) ?? null;
}

/**
 * Deduplicate owned-title detail requests across Shelf and Space and keep
 * previously opened inspectors instant for the lifetime of the page.
 */
export function loadLibraryTitleDetail(titleId: string) {
  const cached = details.get(titleId);
  if (cached) return Promise.resolve(cached);

  const inFlight = pending.get(titleId);
  if (inFlight) return inFlight;

  const request = fetch(
    `/api/library/titles/${encodeURIComponent(titleId)}`,
    { cache: "no-store" },
  )
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("Title details are unavailable right now.");
      }
      return (await response.json()) as PublicSpatialTitleDetail;
    })
    .then((detail) => {
      details.set(titleId, detail);
      return detail;
    })
    .finally(() => {
      pending.delete(titleId);
    });

  pending.set(titleId, request);
  return request;
}
