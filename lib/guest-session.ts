import "server-only";

import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { getAppSession } from "@/lib/app-access";
import { explicitLibraryOwner, runAsLibraryOwner } from "@/lib/library-db";
import { createGuestAccount } from "@/lib/guest-server";
import { guestModeEnabled } from "@/lib/guest-token";
import { SLATE_HOSTED } from "@/lib/public-mode";

/** Make a guest and sign this browser in as them. Returns the guest's id. */
export async function startGuestSession({ onboarded }: { onboarded: boolean }) {
  const { id, token } = await createGuestAccount({ onboarded });
  await signIn("guest", { token, redirect: false });
  return id;
}

/**
 * Run `work` as the signed-in person, or, for a signed-out visitor, as a new
 * guest made on the spot. The session cookie is only written to the response,
 * so the work runs explicitly as the guest rather than reading it back.
 */
export async function asViewerOrGuest<T>(work: () => Promise<T>, signupPath = "/login?mode=create"): Promise<T> {
  // Already running as someone (a guest made earlier in this request).
  if (!SLATE_HOSTED || explicitLibraryOwner()) return work();
  const session = await getAppSession();
  if (session?.user?.id) return work();
  if (!guestModeEnabled()) redirect(signupPath);
  const guestId = await startGuestSession({ onboarded: true });
  return runAsLibraryOwner(guestId, work);
}
