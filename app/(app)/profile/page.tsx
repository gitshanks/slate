import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfileTaste } from "@/components/profile-taste";
import { isGuestOwnerId } from "@/lib/guest-id";
import { getLibraryOwnerId } from "@/lib/library-db";
import { getProfileTaste, getTasteRows, getTopCandidates } from "@/lib/profile-taste";
import { getProfileById, profileAvatarUrl } from "@/lib/profiles";
import { APP_ROOT, SLATE_HOSTED } from "@/lib/public-mode";
import { getEditableListOptions } from "@/lib/shared-lists";

export const metadata: Metadata = {
  title: "Profile · slate",
  robots: { index: false, follow: false },
};

function joinedLabel(createdAt: string) {
  const created = new Date(createdAt);
  return Number.isNaN(created.getTime())
    ? null
    : created.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
}

export default async function ProfilePage() {
  if (!SLATE_HOSTED) redirect(APP_ROOT);
  const ownerId = await getLibraryOwnerId();
  const [profile, taste, candidates, lists] = await Promise.all([
    getProfileById(ownerId),
    getProfileTaste(ownerId),
    getTopCandidates(ownerId),
    getEditableListOptions().catch(() => []),
  ]);
  if (!profile) redirect("/profile/settings");
  const rows = await getTasteRows(ownerId, taste);
  const library = (query: string) => `${APP_ROOT}${query}`;

  return (
    <ProfileTaste
      mode={isGuestOwnerId(profile.id) ? "guest" : "owner"}
      displayName={profile.display_name}
      username={profile.username}
      avatarUrl={profileAvatarUrl(profile)}
      joined={joinedLabel(profile.created_at)}
      isPublic={profile.is_public}
      taste={taste}
      rows={rows}
      candidates={candidates}
      lists={lists}
      spaceHref={library("?view=space")}
      shelfHrefs={{ watched: "/watched", watching: "/watching", want: APP_ROOT }}
      listsHref="/lists"
    />
  );
}
