import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Clock, Eye } from "lucide-react";
import { PublicProfileCollectionView } from "@/components/public-profile-collection-view";
import { getPublicProfile, profileAvatarUrl } from "@/lib/profiles";
import { fetchTitlesByStatusForOwner } from "@/lib/title-filters";
import { cn } from "@/lib/utils";
import type { TitleRow, TitleStatus } from "@/lib/types";
import { SLATE_HOSTED } from "@/lib/public-mode";

type PublicTab = "watchlist" | "watching" | "watched";

const TABS: {
  id: PublicTab;
  label: string;
  status: Exclude<TitleStatus, "dropped">;
  icon: typeof Clock;
}[] = [
  { id: "watchlist", label: "Watchlist", status: "want", icon: Clock },
  { id: "watching", label: "Watching", status: "watching", icon: Eye },
  { id: "watched", label: "Watched", status: "watched", icon: Check },
];

function publicTab(value: string | undefined): PublicTab {
  return TABS.some((tab) => tab.id === value) ? (value as PublicTab) : "watchlist";
}

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
  if (!SLATE_HOSTED) return { title: "Profile not found · slate", robots: { index: false } };
  const { username } = await params;
  const profile = await getPublicProfile(username);
  if (!profile) return { title: "Profile not found · slate", robots: { index: false } };
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://slate.nishh.dev";
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
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  if (!SLATE_HOSTED) notFound();
  const [{ username }, query] = await Promise.all([params, searchParams]);
  const profile = await getPublicProfile(username);
  if (!profile) notFound();
  const avatarUrl = profileAvatarUrl(profile);

  const activeId = publicTab(query.tab);
  const [watchlist, watching, watched] = await Promise.all([
    fetchTitlesByStatusForOwner(profile.id, "want"),
    fetchTitlesByStatusForOwner(profile.id, "watching"),
    fetchTitlesByStatusForOwner(profile.id, "watched"),
  ]);
  const shelves = { watchlist, watching, watched };
  const active = TABS.find((tab) => tab.id === activeId)!;
  const result = shelves[activeId];
  const spatialTitles = interleaveShelves([
    watchlist.titles,
    watching.titles,
    watched.titles,
  ]);

  return (
    <main
      data-public-profile-index
      className="dark min-h-dvh w-full bg-[#080a09] px-4 pb-16 pt-[8.35rem] text-foreground sm:px-6 sm:pt-[5.75rem] lg:px-10"
    >
      <div className="mx-auto w-full max-w-[1600px]">
        <nav
          className="grid w-full grid-cols-3 border-b border-white/10 sm:flex sm:w-fit sm:gap-1 sm:rounded-full sm:border sm:border-border sm:bg-card/70 sm:p-1"
          aria-label="Library shelves"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const selected = tab.id === activeId;
            const count = shelves[tab.id].titles.length;
            return (
              <Link
                key={tab.id}
                href={
                  tab.id === "watchlist"
                    ? `/u/${profile.username}`
                    : `/u/${profile.username}?tab=${tab.id}`
                }
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-11 min-w-0 items-center justify-center gap-1.5 px-1.5 text-xs transition-colors after:absolute after:bottom-[-1px] after:left-1/2 after:h-px after:w-10 after:-translate-x-1/2 after:bg-transparent after:transition-colors sm:h-9 sm:shrink-0 sm:gap-2 sm:rounded-full sm:px-3.5 sm:text-sm sm:after:hidden",
                  selected
                    ? "text-primary after:bg-primary sm:bg-primary sm:text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="hidden h-4 w-4 sm:block" />
                <span className="truncate">{tab.label}</span>
                <span
                  className={cn(
                    "font-mono text-[11px]",
                    selected ? "opacity-75" : "opacity-60",
                  )}
                >
                  {count}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 sm:mt-9">
          <PublicProfileCollectionView
            eyebrow={
              active.id === "watchlist"
                ? "Up next"
                : active.id === "watching"
                  ? "In progress"
                  : "Already seen"
            }
            label={active.label}
            titles={result.titles}
            spatialTitles={spatialTitles}
            genres={result.allGenres}
            status={active.status}
            username={profile.username}
            displayName={profile.display_name}
            avatarUrl={avatarUrl}
          />
        </div>
      </div>
    </main>
  );
}
