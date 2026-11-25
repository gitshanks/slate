import type { Metadata } from "next";
import { signOut } from "@/auth";
import { getLibraryOwnerId } from "@/lib/library-db";
import { getProfileById, profileAvatarUrl } from "@/lib/profiles";
import { ProfileScreen } from "@/components/profile-screen";
import { APP_ROOT, SLATE_HOSTED } from "@/lib/public-mode";
import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/app-access";
import { isAdminEmail } from "@/lib/admin-insights";
import { isGuestOwnerId } from "@/lib/guest-id";

export const metadata: Metadata = {
  title: "Settings · slate",
  robots: { index: false, follow: false },
};

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/" });
}

export default async function ProfilePage() {
  if (!SLATE_HOSTED) redirect(APP_ROOT);
  const ownerId = await getLibraryOwnerId();
  const [profile, session] = await Promise.all([
    getProfileById(ownerId),
    getAppSession(),
  ]);

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
  const created = new Date(profile.created_at);
  const joined = Number.isNaN(created.getTime())
    ? null
    : created.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });

  return (
    <ProfileScreen
      displayName={profile.display_name}
      username={profile.username}
      isPublic={profile.is_public}
      origin={origin}
      avatarUrl={profileAvatarUrl(profile)}
      email={session?.user?.email ?? null}
      joined={joined}
      counts={null}
      isAdmin={isAdminEmail(session?.user?.email)}
      signOutAction={signOutAction}
      isGuest={isGuestOwnerId(profile.id)}
    />
  );
}
