import type { Metadata } from "next";
import { signOut } from "@/auth";
import { getLibraryClient, getLibraryOwnerId } from "@/lib/library-db";
import { getProfileById, profileAvatarUrl } from "@/lib/profiles";
import {
  ProfileScreen,
  type ProfileShelfCounts,
} from "@/components/profile-screen";
import { APP_ROOT, SLATE_HOSTED } from "@/lib/public-mode";
import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/app-access";
import { isAdminEmail } from "@/lib/admin-insights";
import { isGuestOwnerId } from "@/lib/guest-id";

export const metadata: Metadata = {
  title: "Profile · slate",
  robots: { index: false, follow: false },
};

// The shelf counts are a nicety: if they cannot be read the page still opens.
async function shelfCounts(): Promise<ProfileShelfCounts | null> {
  try {
    const db = await getLibraryClient();
    const { data, error } = await db.from("titles").select("status");
    if (error || !data) return null;
    const counts: ProfileShelfCounts = { upNext: 0, watching: 0, watched: 0 };
    for (const row of data) {
      if (row.status === "want") counts.upNext += 1;
      else if (row.status === "watching") counts.watching += 1;
      else if (row.status === "watched") counts.watched += 1;
    }
    return counts;
  } catch {
    return null;
  }
}

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/" });
}

export default async function ProfilePage() {
  if (!SLATE_HOSTED) redirect(APP_ROOT);
  const ownerId = await getLibraryOwnerId();
  const [profile, session, counts] = await Promise.all([
    getProfileById(ownerId),
    getAppSession(),
    shelfCounts(),
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
      counts={counts}
      isAdmin={isAdminEmail(session?.user?.email)}
      signOutAction={signOutAction}
      isGuest={isGuestOwnerId(profile.id)}
    />
  );
}
