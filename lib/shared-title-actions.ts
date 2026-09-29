"use server";

import { addTitle } from "@/lib/actions";
import { getAppSession, hasAppAccess } from "@/lib/app-access";
import { getProfileById } from "@/lib/profiles";
import { SLATE_HOSTED } from "@/lib/public-mode";
import { parseSharedTitle, sharedTitleLoginPath, sharedTitleOnboardingPath } from "@/lib/title-sharing";

export async function saveSharedTitle(type: string, id: number): Promise<
  { ok: true; titleId: string } | { ok: false; destination?: string; message?: string }
> {
  const title = parseSharedTitle(type, id);
  if (!title) return { ok: false, message: "This title could not be found." };

  if (SLATE_HOSTED) {
    const session = await getAppSession();
    if (!session?.user?.id) {
      return { ok: false, destination: sharedTitleLoginPath(title.mediaType, title.tmdbId) };
    }
    const profile = await getProfileById(session.user.id);
    if (!profile) return { ok: false, destination: sharedTitleLoginPath(title.mediaType, title.tmdbId) };
    if (!profile.onboarding_completed_at) {
      return { ok: false, destination: sharedTitleOnboardingPath(title.mediaType, title.tmdbId) };
    }
  } else if (!(await hasAppAccess())) {
    return { ok: false, destination: "/unlock" };
  }

  try {
    // addTitle is idempotent: an existing title keeps its shelf and rating.
    const saved = await addTitle({ tmdbId: title.tmdbId, mediaType: title.mediaType, status: "want" });
    return { ok: true, titleId: saved.id };
  } catch {
    return { ok: false, message: "Couldn't save this title. Try again." };
  }
}
