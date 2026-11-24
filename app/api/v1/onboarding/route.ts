import { runAsLibraryOwner } from "@/lib/library-db";
import { countLibraryTitles, savedTitleKeys, SMALL_LIBRARY_TITLES } from "@/lib/library-nudges";
import { apiData, apiError, NativeApiError, readJsonObject } from "@/lib/native-api/http";
import { authenticateNativeRequest } from "@/lib/native-api/tokens";
import { completeOnboarding } from "@/lib/onboarding-actions";
import { getOnboardingTitles } from "@/lib/onboarding-titles";
import { getProfileById } from "@/lib/profiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The first-run picks of the web's /onboarding, for the phone apps: whether
 * this account still needs them, and the deck of titles to keep or pass.
 * `?more=1` deals a second round to a library under five titles.
 */
export async function GET(request: Request) {
  try {
    const claims = await authenticateNativeRequest(request);
    const profile = await getProfileById(claims.ownerId);
    if (!profile) throw new NativeApiError(404, "not_found", "Profile not found.");
    const wantsMore = new URL(request.url).searchParams.get("more") === "1";
    const more = wantsMore && Boolean(profile.onboarding_completed_at)
      && (await countLibraryTitles(profile.id)) < SMALL_LIBRARY_TITLES;
    const needed = !profile.onboarding_completed_at || more;
    if (!needed) return apiData({ needed: false, more: false, titles: [] });
    // A second visit deals a different deck than the first one did.
    const titles = await getOnboardingTitles(
      more ? `${profile.id}:more:${new Date().toISOString().slice(0, 10)}` : profile.id,
    ).then(async (deck) => {
      if (!more) return deck;
      const saved = await savedTitleKeys(profile.id);
      return deck.filter((title) => !saved.has(`${title.mediaType}:${title.tmdbId}`));
    });
    return apiData({ needed: true, more, titles });
  } catch (error) {
    return apiError(error);
  }
}

/**
 * Saves the titles kept, in the order they were kept, to Up Next and marks
 * the account as started, as finishing the web's deck does.
 */
export async function POST(request: Request) {
  try {
    const claims = await authenticateNativeRequest(request);
    const body = await readJsonObject(request);
    const form = new FormData();
    form.set("selections", JSON.stringify(Array.isArray(body.selections) ? body.selections : []));
    if (body.more === true) form.set("more", "1");
    const result = await runAsLibraryOwner(claims.ownerId, () =>
      completeOnboarding({ ok: false, message: "" }, form),
    );
    if (!result.ok) throw new NativeApiError(400, "bad_request", result.message);
    return apiData({ savedCount: result.savedCount ?? 0, message: result.message });
  } catch (error) {
    return apiError(error);
  }
}
