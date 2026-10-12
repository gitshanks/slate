import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PublicProfileCollectionView } from "@/components/public-profile-collection-view";
import { getAppSession } from "@/lib/app-access";
import { getPublicProfile, profileAvatarUrl } from "@/lib/profiles";
import { siteOrigin } from "@/lib/site-url";
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
  const origin = siteOrigin();
  const canonical = `${origin}/u/${profile.username}`;
  const description = `See what ${profile.display_name} wants to watch, is watching, and has watched.`;

  return {
    metadataBase: new URL(origin),
    title: `${profile.display_name}'s watchlist · slate`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${profile.display_name}'s slate`,
      description: `Browse ${profile.display_name}'s shelves on slate.`,
      url: canonical,
      siteName: "slate",
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title: `${profile.display_name}'s slate`,
      description: `Browse ${profile.display_name}'s shelves on slate.`,
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
  let viewerSignedIn = false;
  try {
    const session = await getAppSession();
    viewerSignedIn = Boolean(session?.user?.id);
  } catch {
    viewerSignedIn = false;
  }

  return (
    <main
      data-public-profile-index
      className="dark min-h-dvh w-full bg-[#080a09] text-foreground"
    >
      <Suspense fallback={null}>
        <PublicProfileCollectionView
          titles={titles}
          username={profile.username}
          displayName={profile.display_name}
          avatarUrl={avatarUrl}
          viewerSignedIn={viewerSignedIn}
        />
      </Suspense>
    </main>
  );
}
