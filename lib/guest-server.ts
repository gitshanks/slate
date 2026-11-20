import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { runNeonQuery, runNeonTransaction } from "@/lib/neon-client";
import { ensureOnboardingSchema } from "@/lib/onboarding-schema";
import { GUEST_ID_PREFIX, isGuestOwnerId } from "@/lib/guest-id";
import { mergeGuestIntoAccount, pruneIdleGuests } from "@/lib/guest-merge";
import {
  GUEST_COOKIE,
  guestCookieOptions,
  guestModeEnabled,
  signGuestToken,
  verifyGuestToken,
} from "@/lib/guest-token";

/** How long a guest nobody opens is kept. */
export const GUEST_IDLE_DAYS = 60;

/**
 * Make a guest account and leave its signed token in the guest cookie. The
 * caller then signs the browser in with the token (lib/guest-session.ts).
 * `onboarded` skips the first-account picks: someone who arrived by adding a
 * list already has a slate worth opening.
 */
export async function createGuestAccount({ onboarded }: { onboarded: boolean }) {
  if (!guestModeEnabled()) throw new Error("Guest mode is not available here.");
  await ensureOnboardingSchema();
  const id = `${GUEST_ID_PREFIX}${randomUUID()}`;
  await runNeonQuery(
    `insert into profiles (id, username, display_name, onboarding_completed_at)
     values ($1, $2, 'Guest', $3)`,
    [id, `guest-${randomBytes(8).toString("hex")}`, onboarded ? new Date().toISOString() : null],
  );
  const token = await signGuestToken(id);
  (await cookies()).set(GUEST_COOKIE, token, guestCookieOptions());

  // Clearing out idle guests rides along with new ones, a few at a time, so
  // it needs no scheduled job and never slows a request noticeably.
  void runNeonTransaction((client) => pruneIdleGuests(client, GUEST_IDLE_DAYS)).catch(() => undefined);
  return { id, token };
}

/**
 * At a real sign-in, move the browser's guest slate into the account. Runs in
 * the Auth.js jwt callback. Never throws: a failed move leaves the guest and
 * its cookie in place, so the next sign-in tries again.
 */
export async function claimGuestForAccount(accountId: string) {
  if (!guestModeEnabled() || isGuestOwnerId(accountId)) return null;
  try {
    const jar = await cookies();
    const guestId = await verifyGuestToken(jar.get(GUEST_COOKIE)?.value);
    if (!guestId) return null;
    const result = await runNeonTransaction((client) =>
      mergeGuestIntoAccount(client, guestId, accountId),
    );
    try {
      jar.delete({ name: GUEST_COOKIE, path: "/" });
    } catch {
      // Some callback contexts can't write cookies; the guest is gone anyway,
      // so the stale token now verifies to nothing.
    }
    return result;
  } catch (error) {
    console.error("[guest] could not move a guest slate into an account", error);
    return null;
  }
}

/** Mark a guest as active, at most once a day, so idle pruning spares them. */
export async function touchGuest(guestId: string) {
  if (!isGuestOwnerId(guestId) || !process.env.DATABASE_URL) return;
  await runNeonQuery(
    "update profiles set updated_at = now() where id = $1 and updated_at < now() - interval '1 day'",
    [guestId],
  );
}
