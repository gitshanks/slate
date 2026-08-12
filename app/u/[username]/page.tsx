import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicProfileCollectionView } from "@/components/public-profile-collection-view";
import { getPublicProfile, profileAvatarUrl } from "@/lib/profiles";
import { fetchTitlesByStatusForOwner } from "@/lib/title-filters";
import type { TitleRow } from "@/lib/types";
import { SLATE_HOSTED } from "@/lib/public-mode";

function interleaveShelves(shelves: TitleRow[][]) {
  const longestShelf = Math.max(0, ...shelves.map((shelf) => shelf.length));
  const titles: TitleRow[] = [];

  for (let index = 0; index < longestShelf; index += 1) {
    for (const shelf of shelves) {
      const title = shelf[index];
      if (title) titles.push(title);
    }
  }

  return titles;
}

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
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://s1ate.space";
  const avatarUrl = profileAvatarUrl(profile, origin);

  return {
    title: `${profile.display_name}'s watchlist · slate`,
    description: `See what ${profile.display_name} wants to watch, is watching, and has watched.`,
    openGraph: {
      title: `${profile.display_name}'s watchlist`,
      description: `Browse ${profile.display_name}'s shelves on slate.`,
      type: "profile",
      images: avatarUrl ? [avatarUrl] : undefined,
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
  const avatarUrl = profileAvatarUrl(profile);

  const [watchlist, watching, watched] = await Promise.all([
    fetchTitlesByStatusForOwner(profile.id, "want"),
    fetchTitlesByStatusForOwner(profile.id, "watching"),
    fetchTitlesByStatusForOwner(profile.id, "watched"),
  ]);
  const titles = interleaveShelves([
    watchlist.titles,
    watching.titles,
    watched.titles,
  ]);

  return (
    <main
      data-public-profile-index
      className="dark min-h-dvh w-full bg-[#080a09] text-foreground"
    >
      <PublicProfileCollectionView
        titles={titles}
        username={profile.username}
        displayName={profile.display_name}
        avatarUrl={avatarUrl}
      />
    </main>
  );
}
