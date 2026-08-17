import type { PersonProfileDetail } from "@/lib/person-detail-types";

const details = new Map<number, PersonProfileDetail>();
const pending = new Map<number, Promise<PersonProfileDetail>>();

export function getCachedPersonDetail(id: number) {
  return details.get(id) ?? null;
}

export function loadPersonDetail(id: number) {
  const cached = details.get(id);
  if (cached) return Promise.resolve(cached);

  const inFlight = pending.get(id);
  if (inFlight) return inFlight;

  const request = fetch(`/api/people/${id}`)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("This person’s details are unavailable right now.");
      }
      return (await response.json()) as PersonProfileDetail;
    })
    .then((detail) => {
      details.set(id, detail);
      return detail;
    })
    .finally(() => {
      if (pending.get(id) === request) pending.delete(id);
    });

  pending.set(id, request);
  return request;
}
