import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AnalyticsIdentity } from "@/components/analytics/analytics-identity";
import { OnboardingDeck } from "@/components/onboarding/onboarding-deck";
import { getAppSession } from "@/lib/app-access";
import { getOnboardingTitles } from "@/lib/onboarding-titles";
import { getProfileById } from "@/lib/profiles";
import { SLATE_HOSTED } from "@/lib/public-mode";
import { getSharedTitle } from "@/lib/shared-title-data";
import { sharedTitleFromPath, sharedTitleLoginPath, titleSharePath } from "@/lib/title-sharing";

export const metadata: Metadata = {
  title: "Welcome to slate",
  description: "Pick a few titles and shape your first slate.",
  robots: { index: false, follow: false },
};

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  if (!SLATE_HOSTED) redirect("/");
  const query = await searchParams;
  const recommendation = sharedTitleFromPath(query.next);
  const returnTo = recommendation ? titleSharePath(recommendation.mediaType, recommendation.tmdbId) : "/app";
  const session = await getAppSession();
  if (!session?.user?.id) redirect(recommendation ? sharedTitleLoginPath(recommendation.mediaType, recommendation.tmdbId) : "/login?mode=create");
  const profile = await getProfileById(session.user.id);
  if (!profile) redirect("/login?error=Configuration");
  if (profile.onboarding_completed_at) redirect(returnTo);
  const [deck, shared] = await Promise.all([
    getOnboardingTitles(profile.id),
    recommendation ? getSharedTitle(recommendation.mediaType, String(recommendation.tmdbId)).catch(() => null) : Promise.resolve(null),
  ]);
  // The recommendation is the first card, with the same explicit Keep/Pass
  // choice as every other title. No title is saved just by opening a link.
  const titles = shared ? [{
    tmdbId: shared.tmdb_id,
    mediaType: shared.media_type,
    title: shared.title,
    overview: shared.overview || "",
    posterPath: shared.poster_path || "",
    backdropPath: shared.backdrop_path || "",
    releaseDate: shared.release_date,
    genres: shared.genres?.map((genre) => genre.name) ?? [],
  }, ...deck.filter((title) => title.tmdbId !== shared.tmdb_id || title.mediaType !== shared.media_type)].slice(0, deck.length || 20) : deck;

  return (
    <>
      <AnalyticsIdentity
        id={profile.id}
        email={session.user.email}
        displayName={profile.display_name}
        createdAt={profile.created_at}
      />
      <OnboardingDeck titles={titles} returnTo={returnTo} />
    </>
  );
}
