"use server";

import { redirect } from "next/navigation";
import { addTitle } from "@/lib/actions";
import { getAppSession } from "@/lib/app-access";
import { asViewerOrGuest, startGuestSession } from "@/lib/guest-session";
import { guestModeEnabled } from "@/lib/guest-token";
import { SLATE_HOSTED } from "@/lib/public-mode";
import { sharedTitleFromPath } from "@/lib/title-sharing";
import type { TitleStatus } from "@/lib/types";

/**
 * "Try it first": start a guest slate and go to the first-account picks,
 * keeping a shared title as the first card when the visitor came from one.
 */
export async function startAsGuest(formData: FormData) {
  if (!SLATE_HOSTED || !guestModeEnabled()) redirect("/login?mode=create");
  const next = String(formData.get("next") ?? "");
  const session = await getAppSession();
  if (!session?.user?.id) await startGuestSession({ onboarded: false });
  const shared = sharedTitleFromPath(next);
  redirect(shared ? `/onboarding?next=${encodeURIComponent(next)}` : "/onboarding");
}

/**
 * Save a title from a public page (someone's profile, a shared title). A
 * signed-out visitor gets a guest slate instead of a login wall.
 */
export async function saveTitleAsViewer(input: {
  tmdbId: number;
  mediaType: "movie" | "tv";
  status?: TitleStatus;
}) {
  return asViewerOrGuest(() => addTitle(input));
}
