import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AnalyticsIdentity } from "@/components/analytics/analytics-identity";
import { OnboardingDeck } from "@/components/onboarding/onboarding-deck";
import { getAppSession } from "@/lib/app-access";
import { getOnboardingTitles } from "@/lib/onboarding-titles";
import { getProfileById } from "@/lib/profiles";
import { SLATE_HOSTED } from "@/lib/public-mode";

export const metadata: Metadata = {
  title: "Welcome to slate",
  description: "Pick a few titles and shape your first slate.",
  robots: { index: false, follow: false },
};

export default async function OnboardingPage() {
  if (!SLATE_HOSTED) redirect("/");
  const session = await getAppSession();
  if (!session?.user?.id) redirect("/login?mode=create");
  const profile = await getProfileById(session.user.id);
  if (!profile) redirect("/login?error=Configuration");
  if (profile.onboarding_completed_at) redirect("/app");
  const titles = await getOnboardingTitles(profile.id);

  return (
    <>
      <AnalyticsIdentity
        id={profile.id}
        email={session.user.email}
        displayName={profile.display_name}
        createdAt={profile.created_at}
      />
      <OnboardingDeck titles={titles} />
    </>
  );
}
