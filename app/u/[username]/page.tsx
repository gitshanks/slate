import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProfileTaste } from "@/components/profile-taste";
import { PublicProfileHeader } from "@/components/public-profile-header";
import { getAppSession } from "@/lib/app-access";
import { getProfileTaste, getTasteRows } from "@/lib/profile-taste";
import { getPublicProfile, profileAvatarUrl } from "@/lib/profiles";
import { SLATE_HOSTED } from "@/lib/public-mode";
import { siteOrigin } from "@/lib/site-url";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  if (!SLATE_HOSTED) {
    return { title: "Profile not found · slate", robots: { index: false } };
  }
  const { username } = await params;
  const profile = await getPublicProfile(username);
  if (!profile) {
    return { title: "Profile not found · slate", robots: { index: false } };
  }
  const origin = siteOrigin();
  const canonical = `${origin}/u/${profile.username}`;
  const description = `${profile.display_name}'s Top 4, what they're watching and what they love, on slate.`;

  return {
    metadataBase: new URL(origin),
    title: `${profile.display_name} · slate`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${profile.display_name}'s slate`,
      description,
      url: canonical,
      siteName: "slate",
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title: `${profile.display_name}'s slate`,
      description,
    },
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  if (!SLATE_HOSTED) notFound();
  const { username } = await params;
  const profile = await getPublicProfile(username);
  if (!profile) notFound();

  const taste = await getProfileTaste(profile.id);
  const [rows, viewerSignedIn] = await Promise.all([
    getTasteRows(profile.id, taste),
    getAppSession()
      .then((session) => Boolean(session?.user?.id))
      .catch(() => false),
  ]);
  const created = new Date(profile.created_at);
  const joined = Number.isNaN(created.getTime())
    ? null
    : created.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
  const space = `/u/${profile.username}/space`;

  return (
    // data-public-profile-index keeps public pages dark and hides the
    // layout's bar; this page floats its own over the backdrop.
    <main data-public-profile-index className="dark relative min-h-dvh w-full bg-background text-foreground">
      <PublicProfileHeader overlay />
      <ProfileTaste
        mode="visitor"
        displayName={profile.display_name}
        username={profile.username}
        avatarUrl={profileAvatarUrl(profile)}
        joined={joined}
        isPublic
        taste={taste}
        rows={rows}
        spaceHref={space}
        shelfHrefs={{
          watched: `${space}?spaceStatus=watched`,
          watching: `${space}?spaceStatus=watching`,
          want: `${space}?spaceStatus=want`,
        }}
        listsHref={null}
        viewerSignedIn={viewerSignedIn}
      />
    </main>
  );
}
