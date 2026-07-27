import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Clock, Eye, Film, UserRound } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { FilteredGrid } from "@/components/filtered-grid";
import { getPublicProfile } from "@/lib/profiles";
import { fetchTitlesByStatusForOwner } from "@/lib/title-filters";
import { cn } from "@/lib/utils";
import type { TitleStatus } from "@/lib/types";
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  if (!SLATE_HOSTED) return { title: "Profile not found — slate", robots: { index: false } };
  const { username } = await params;
  const profile = await getPublicProfile(username);
  if (!profile) return { title: "Profile not found — slate", robots: { index: false } };

  return {
    title: `${profile.display_name}'s watchlist — slate`,
    description: `See what ${profile.display_name} wants to watch, is watching, and has watched.`,
    openGraph: {
      title: `${profile.display_name}'s watchlist`,
      description: `Browse ${profile.display_name}'s shelves on slate.`,
      type: "profile",
      images: profile.avatar_url ? [profile.avatar_url] : undefined,
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

  const activeId = publicTab(query.tab);
  const [watchlist, watching, watched] = await Promise.all([
    fetchTitlesByStatusForOwner(profile.id, "want"),
    fetchTitlesByStatusForOwner(profile.id, "watching"),
    fetchTitlesByStatusForOwner(profile.id, "watched"),
  ]);
  const shelves = { watchlist, watching, watched };
  const active = TABS.find((tab) => tab.id === activeId)!;
  const result = shelves[activeId];

  return (
    <>
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-10">
          <Link href="/" aria-label="Slate home" className="flex items-center">
            <Image
              src="/brand/logo-light.svg"
              alt="Slate"
              width={62}
              height={17}
              priority
              className="hidden h-[17px] w-auto dark:block"
            />
            <Image
              src="/brand/logo-dark.svg"
              alt="Slate"
              width={62}
              height={17}
              priority
              className="h-[17px] w-auto dark:hidden"
            />
          </Link>
          <Link
            href="/login"
            className="inline-flex h-9 items-center rounded-full border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-accent"
          >
            Make your own
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] px-4 pb-16 pt-8 sm:px-6 sm:pt-10 lg:px-10 lg:pt-12">
        <section className="flex items-center gap-4">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt=""
              referrerPolicy="no-referrer"
              className="h-16 w-16 rounded-full border border-border object-cover sm:h-20 sm:w-20"
            />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-card text-muted-foreground sm:h-20 sm:w-20">
              <UserRound className="h-7 w-7" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-xs font-mono tracking-[0.12em] text-muted-foreground">
              @{profile.username}
            </p>
            <h1 className="mt-1 truncate text-3xl font-semibold tracking-tight sm:text-4xl">
              {profile.display_name}&rsquo;s slate
            </h1>
          </div>
        </section>

        <nav className="mt-9 flex w-fit max-w-full gap-1 overflow-x-auto rounded-full border border-border bg-card/70 p-1" aria-label="Library shelves">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const selected = tab.id === activeId;
            const count = shelves[tab.id].titles.length;
            return (
              <Link
                key={tab.id}
                href={tab.id === "watchlist" ? `/u/${profile.username}` : `/u/${profile.username}?tab=${tab.id}`}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm transition-colors",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                <span className={cn("font-mono text-[11px]", selected ? "opacity-75" : "opacity-60")}>
                  {count}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-9">
          <div className="mb-6">
            <p className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
              {active.id === "watchlist"
                ? "Up next"
                : active.id === "watching"
                  ? "In progress"
                  : "Already seen"}
            </p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight">{active.label}</h2>
          </div>

          <FilterBar
            genres={result.allGenres}
            showSentiment={active.status === "watched"}
            recentSortLabel={active.status === "watched" ? "Recently watched" : undefined}
          />

          {result.titles.length === 0 ? (
            <EmptyState
              icon={<Film className="h-6 w-6" />}
              title={`Nothing in ${active.label.toLowerCase()} yet`}
              description="This shelf is waiting for its first title."
            />
          ) : (
            <Suspense fallback={null}>
              <FilteredGrid
                allTitles={result.titles}
                status={active.status}
                readOnly
              />
            </Suspense>
          )}
        </div>
      </main>
    </>
  );
}
