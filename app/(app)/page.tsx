import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { Film } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { LibraryCollectionView } from "@/components/library-collection-view";
import { getLibraryOwnerId } from "@/lib/library-db";
import { getEditableListOptions } from "@/lib/shared-lists";
import { getProfileById, profileAvatarUrl } from "@/lib/profiles";
import { SLATE_HOSTED } from "@/lib/public-mode";
import { fetchTitlesByStatus } from "@/lib/title-filters";
import { getNewEpisodes, suggestList } from "@/lib/library-nudges";
import type { TitleRow } from "@/lib/types";
import { guestIsReturning, isGuestOwnerId } from "@/lib/guest-id";

export const metadata: Metadata = {
  title: "Library · slate",
};

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

export default async function LibraryPage() {
  const [ownerId, watchlist, watching, watched] = await Promise.all([
    getLibraryOwnerId(),
    fetchTitlesByStatus("want"),
    fetchTitlesByStatus("watching"),
    fetchTitlesByStatus("watched"),
  ]);
  const [profile, lists] = await Promise.all([
    SLATE_HOSTED ? getProfileById(ownerId) : Promise.resolve(null),
    getEditableListOptions(),
  ]);
  const firstError = watchlist.error ?? watching.error ?? watched.error;

  if (firstError) {
    return (
      <EmptyState
        icon={<Film className="h-6 w-6" />}
        title="Couldn’t reach the database"
        description={firstError.message}
      />
    );
  }

  const titles = interleaveShelves([
    watchlist.titles,
    watching.titles,
    watched.titles,
  ]);
  // Only when nothing shared or owned exists yet: the first list is the nudge.
  const listSuggestion = lists.length ? null : suggestList(titles);
  const hiddenNudges = ((await cookies()).get("slate_nudges_hidden")?.value ?? "").split(".");
  const newEpisodes = await getNewEpisodes(ownerId, watching.titles).catch(() => []);
  const guestNudge =
    isGuestOwnerId(ownerId) && profile
      ? {
          listCount: lists.length,
          returning: guestIsReturning(profile.created_at),
        }
      : null;

  return (
    <Suspense fallback={null}>
      <LibraryCollectionView
        newEpisodes={newEpisodes}
        hiddenNudges={hiddenNudges}
        guestNudge={guestNudge}
        listSuggestion={listSuggestion}
        canPickMore={SLATE_HOSTED}
        titles={titles}
        displayName={profile?.display_name || "You"}
        avatarUrl={profile ? profileAvatarUrl(profile) : null}
        shareProfile={profile ? { username: profile.username, isPublic: profile.is_public } : null}
        lists={lists}
      />
    </Suspense>
  );
}
