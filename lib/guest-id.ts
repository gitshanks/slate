// Guests are real accounts the server makes on a signed-out visitor's first
// action (adding a list from a reel, saving a title, "Try it first"), so every
// feature works before signup. Shared by server and client code: it holds no
// secret, only the shape of a guest's owner id.

export const GUEST_ID_PREFIX = "guest:";

export function isGuestOwnerId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(GUEST_ID_PREFIX);
}

/** Where a guest goes to save their slate, coming back to `next` after. */
export function guestSignupPath(next?: string | null): string {
  const params = new URLSearchParams({ mode: "create" });
  if (next && next.startsWith("/") && !next.startsWith("//") && next !== "/app") {
    params.set("next", next);
  }
  return `/login?${params}`;
}

/** A guest who first came at least half a day ago is back for another visit. */
export function guestIsReturning(createdAt: string, now = Date.now()): boolean {
  const created = new Date(createdAt).getTime();
  return Number.isFinite(created) && now - created > 12 * 60 * 60 * 1000;
}
