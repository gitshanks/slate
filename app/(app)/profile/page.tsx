import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { signOut } from "@/auth";
import { getLibraryOwnerId } from "@/lib/library-db";
import { getProfileById, profileAvatarUrl } from "@/lib/profiles";
import { ProfileSettingsForm } from "@/components/profile-settings-form";
import { APP_ROOT, SLATE_HOSTED } from "@/lib/public-mode";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PrivacyPreferencesButton } from "@/components/analytics/privacy-preferences-button";
import { DeleteAccountSettings } from "@/components/delete-account-settings";

export const metadata: Metadata = {
  title: "Profile · slate",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  if (!SLATE_HOSTED) redirect(APP_ROOT);
  const ownerId = await getLibraryOwnerId();
  const profile = await getProfileById(ownerId);

  if (!profile) {
    return (
      <div className="mx-auto max-w-xl rounded-[1.5rem] border border-border/70 bg-card/50 p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Profile unavailable</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Profile settings are available on the hosted account version of slate.
        </p>
      </div>
    );
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://www.s1ate.space";
  const avatarUrl = profileAvatarUrl(profile);

  return (
    <div className="mx-auto w-full max-w-3xl pb-4 sm:pb-8">
      <header className="max-w-2xl">
        <h1 className="text-[2.5rem] font-semibold leading-none tracking-[-0.05em] sm:text-5xl">
          Profile
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-[15px]">
          Manage how you appear on slate and what friends can see.
        </p>
      </header>

      <div className="mt-7 min-w-0 sm:mt-9">
        <ProfileSettingsForm
          displayName={profile.display_name}
          username={profile.username}
          isPublic={profile.is_public}
          origin={origin}
          avatarUrl={avatarUrl}
        />

        <section className="mt-5 flex flex-col gap-4 rounded-[1.5rem] border border-border/70 bg-card/45 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 className="text-sm font-medium">Data and privacy</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Review what slate collects or change optional analytics.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/privacy" className="text-xs font-medium text-muted-foreground hover:text-foreground">
              Read details
            </Link>
            <PrivacyPreferencesButton compact />
          </div>
        </section>

        <DeleteAccountSettings />

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
          className="mt-5 flex justify-end"
          data-analytics-reset="true"
          data-analytics-form="sign_out"
        >
          <button
            type="submit"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border/70 bg-card/35 px-4 text-xs font-medium text-muted-foreground transition-[background-color,border-color,color,transform] hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive active:scale-[0.98] sm:w-auto"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
