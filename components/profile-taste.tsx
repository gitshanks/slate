"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronRight,
  Film,
  Globe2,
  Heart,
  Lock,
  Pencil,
  Settings,
  Share2,
  ThumbsUp,
} from "lucide-react";
import { toast } from "sonner";
import { LibraryTitleActions } from "@/components/library-title-actions";
import { PublicProfileTitleActions } from "@/components/public-profile-title-actions";
import { ProfileTopPicker, type TopCandidate } from "@/components/profile-top-picker";
import {
  CollectionTitleDetailOverlay,
  type TitleDetailSource,
} from "@/components/spatial-poster-grid";
import { SignupActions } from "@/components/guest-context";
import { captureAnalytics } from "@/lib/analytics";
import {
  getCachedLibraryTitleDetail,
  loadLibraryTitleDetail,
} from "@/lib/library-title-detail-cache";
import {
  getCachedPublicTitleDetail,
  loadPublicTitleDetail,
} from "@/lib/public-title-detail-cache";
import type {
  ProfileTaste as Taste,
  TastePoster,
} from "@/lib/profile-taste-core";
import { backdropUrl, posterUrl } from "@/lib/tmdb-image";
import type { TitleRow } from "@/lib/types";
import { cn } from "@/lib/utils";

type Mode = "owner" | "visitor" | "guest";

export interface ProfileTasteProps {
  mode: Mode;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  /** Already formatted, e.g. "March 2026". */
  joined: string | null;
  isPublic: boolean;
  taste: Taste | null;
  /** Full rows for every title the page shows, for the title card. */
  rows: Record<string, TitleRow>;
  /** Owner only: everything that can go in the Top 4. */
  candidates?: TopCandidate[];
  lists?: { id: string; name: string }[];
  /** Where the whole slate opens: the Library's Space, or the public wall. */
  spaceHref: string;
  shelfHrefs: { watched: string; watching: string; want: string };
  listsHref: string | null;
  viewerSignedIn?: boolean;
}

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

function Avatar({
  src,
  name,
  className,
}: {
  src: string | null;
  name: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary/15 font-semibold text-primary",
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden>{name.slice(0, 1).toLocaleUpperCase()}</span>
      )}
    </span>
  );
}

/**
 * A number that counts up once when the page arrives. CSS does the counting
 * (a registered integer property, globals.css § Profile), so the real number
 * is in the page before any script runs and reduced motion simply shows it.
 */
function Count({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("taste-count tabular-nums", className)}>
      <span
        aria-hidden
        className="taste-count-ticker"
        style={{ "--n": value } as React.CSSProperties}
      />
      <span className="taste-count-value">{value.toLocaleString("en-US")}</span>
    </span>
  );
}

function Poster({
  poster,
  sizes,
  className,
}: {
  poster: TastePoster;
  sizes: string;
  className?: string;
}) {
  const src = posterUrl(poster.posterPath, "w342");
  return (
    <span
      className={cn(
        "relative block aspect-[2/3] overflow-hidden bg-card shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.08)]",
        className,
      )}
    >
      <span className="absolute inset-x-2 bottom-2 text-[11px] font-semibold leading-tight text-muted-foreground">
        {poster.title}
      </span>
      {src ? (
        <Image src={src} alt="" fill sizes={sizes} className="object-cover" />
      ) : null}
    </span>
  );
}

function SectionHead({
  id,
  title,
  aside,
}: {
  id: string;
  title: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3">
      <h2 id={id} className="min-w-0 truncate text-[13px] font-medium text-muted-foreground">
        {title}
      </h2>
      {aside}
    </div>
  );
}

function plural(n: number, one: string, many: string) {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}

function percent(share: number) {
  return `${Math.round(share * 100)}%`;
}

function rise(index: number): React.CSSProperties {
  return { "--i": index } as React.CSSProperties;
}

export function ProfileTaste({
  mode,
  displayName,
  username,
  avatarUrl,
  joined,
  isPublic,
  taste,
  rows,
  candidates = [],
  lists = [],
  spaceHref,
  shelfHrefs,
  listsHref,
  viewerSignedIn = false,
}: ProfileTasteProps) {
  const owner = mode === "owner";
  const visitor = mode === "visitor";
  const [openTitle, setOpenTitle] = React.useState<{
    row: TitleRow;
    anchor: string;
  } | null>(null);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  // The header gives way to a slim bar once the name scrolls out of view.
  React.useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setCollapsed(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // The owner's card reads their library; a visitor's reads the public profile.
  const detailSource = React.useMemo<TitleDetailSource>(
    () =>
      visitor
        ? {
            getCached: (title) => getCachedPublicTitleDetail(username, title.id),
            load: (title) => loadPublicTitleDetail(username, title.id),
          }
        : {
            getCached: (title) => getCachedLibraryTitleDetail(title.id),
            load: (title) => loadLibraryTitleDetail(title.id),
          },
    [username, visitor],
  );

  const open = React.useCallback(
    (poster: TastePoster, anchor: string) => {
      const row = rows[poster.id];
      if (!row) return;
      void detailSource.load(row).catch(() => undefined);
      setOpenTitle({ row, anchor });
    },
    [detailSource, rows],
  );
  const close = React.useCallback(() => setOpenTitle(null), []);

  const top = taste?.top ?? [];
  // Nobody picked these: the slate's favourites stand in until its owner
  // changes them, and nothing is saved until then.
  const suggested = Boolean(taste?.topSuggested);
  const hero = top[0] ?? null;
  const heroSrc = hero ? backdropUrl(hero.backdropPath, "w1280") : null;
  const watchedAny = (taste?.counts.watched ?? 0) > 0;
  const empty = !taste || taste.total === 0;
  const profileUrl = `/u/${username}`;

  async function share() {
    const url = new URL(profileUrl, window.location.origin).href;
    try {
      if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ title: `${displayName} on slate`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      captureAnalytics("profile_link_copied", { public_profile: true, source: "profile" });
      toast.success("Link copied");
    } catch (error) {
      if ((error as Error)?.name === "AbortError") return;
      toast.error("Couldn't copy the link. Try again from Settings.");
    }
  }

  const iconButton =
    "inline-flex h-11 w-11 items-center justify-center rounded-full border border-foreground/15 bg-background/45 text-foreground backdrop-blur-xl transition-[background-color,transform] duration-150 hover:bg-background/70 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
  const pillButton =
    "inline-flex h-11 items-center justify-center gap-2 rounded-[14px] px-4 text-sm font-medium transition-[background-color,transform] duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-10";

  const ownerControls = owner ? (
    <>
      {isPublic ? (
        <button type="button" onClick={share} aria-label="Share your profile" className={iconButton}>
          <Share2 className="h-[18px] w-[18px]" />
        </button>
      ) : null}
      <Link href="/profile/settings" aria-label="Settings" className={iconButton}>
        <Settings className="h-[18px] w-[18px]" />
      </Link>
    </>
  ) : mode === "guest" ? (
    <Link href="/profile/settings" aria-label="Settings" className={iconButton}>
      <Settings className="h-[18px] w-[18px]" />
    </Link>
  ) : null;

  let section = 0;

  return (
    <div
      data-mode={mode}
      className={cn(
        "taste relative",
        // In the app the page sits in padded scroll area; the backdrop runs
        // edge to edge, so the profile steps out of that padding.
        visitor
          ? "w-full pb-16"
          : "-mx-4 -mt-5 sm:-mx-6 sm:-mt-6 lg:-mx-10 lg:-mt-8",
      )}
    >
      {/* The slim bar the header collapses into. */}
      <div
        data-collapsed={collapsed ? "true" : "false"}
        aria-hidden={!collapsed}
        className={cn("taste-bar sticky top-0 z-30 h-0", !visitor && "md:top-16")}
      >
        <div className="taste-bar-inner relative overflow-hidden border-b border-border/60">
          {heroSrc ? (
            <Image src={heroSrc} alt="" fill sizes="100vw" className="object-cover opacity-60" data-image-arrival="off" />
          ) : null}
          <div className="absolute inset-0 bg-background/80 backdrop-blur-2xl" />
          <div className="relative mx-auto flex h-14 max-w-6xl items-center gap-2.5 px-4 sm:px-6">
            <Avatar src={avatarUrl} name={displayName} className="h-8 w-8 text-[13px]" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[15px] font-semibold tracking-[-0.02em]">{displayName}</p>
              {taste && watchedAny ? (
                <p className="truncate text-[12px] text-muted-foreground">
                  {plural(taste.hours, "hour", "hours")} across {plural(taste.counts.watched, "title", "titles")}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2 [&>*]:h-9 [&>*]:w-9">{collapsed ? ownerControls : null}</div>
          </div>
        </div>
      </div>

      {/* Header: the backdrop of the Top 4's first title. */}
      <header className="relative">
        <div
          className={cn(
            "taste-hero relative overflow-hidden",
            !heroSrc && "taste-hero-empty",
          )}
        >
          {heroSrc ? (
            <div className="taste-hero-image absolute inset-x-0 bottom-0 top-[-40%]">
              <Image
                src={heroSrc}
                alt=""
                fill
                priority
                sizes="100vw"
                className="object-cover object-[50%_30%]"
              />
            </div>
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/35 to-background" />
          {ownerControls ? (
            <div className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top))] flex gap-2 sm:right-6">{ownerControls}</div>
          ) : null}
        </div>

        <div className="relative mx-auto -mt-16 max-w-6xl px-4 sm:-mt-24 sm:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-8">
            <div className="flex flex-col gap-3.5 md:flex-row md:items-end md:gap-6">
              <Avatar
                src={avatarUrl}
                name={displayName}
                className="h-[88px] w-[88px] border-4 border-background text-3xl md:h-32 md:w-32 md:text-[44px]"
              />
              <div className="flex min-w-0 flex-col gap-1.5 md:pb-1.5">
                <h1 className="text-[2rem] font-bold leading-none tracking-[-0.045em] [overflow-wrap:break-word] md:text-[3.25rem]">
                  {displayName}
                </h1>
                <p className="font-mono text-[13px] text-muted-foreground">@{username}</p>
                {taste?.tagline ? (
                  <p className="mt-1 text-[15px] leading-snug text-foreground/85">{taste.tagline}</p>
                ) : null}
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[13px] text-muted-foreground">
                  {visitor ? null : (
                    <span className="inline-flex items-center gap-1.5">
                      {isPublic ? <Globe2 className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                      {isPublic ? "Public" : "Private"}
                    </span>
                  )}
                  {joined ? <span>Joined {joined}</span> : null}
                </p>
              </div>
            </div>

            {owner ? (
              <div className="grid grid-cols-2 gap-2 md:flex md:pb-1.5">
                <Link href="/profile/settings" className={cn(pillButton, "border border-border bg-card hover:bg-accent")}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit profile
                </Link>
                {isPublic ? (
                  <button type="button" onClick={share} className={cn(pillButton, "bg-primary font-semibold text-primary-foreground hover:bg-primary/90")}>
                    <Share2 className="h-3.5 w-3.5" />
                    Share profile
                  </button>
                ) : (
                  <Link href="/profile/settings#profile-sharing" className={cn(pillButton, "bg-primary font-semibold text-primary-foreground hover:bg-primary/90")}>
                    <Globe2 className="h-3.5 w-3.5" />
                    Make it public
                  </Link>
                )}
              </div>
            ) : visitor ? (
              <div className="grid grid-cols-2 gap-2 md:flex md:pb-1.5">
                <button type="button" onClick={share} className={cn(pillButton, "border border-border bg-card hover:bg-accent")}>
                  Copy link
                </button>
                <Link href={spaceHref} className={cn(pillButton, "bg-primary font-semibold text-primary-foreground hover:bg-primary/90")}>
                  {taste ? `Browse ${plural(taste.total, "title", "titles")}` : "Browse their slate"}
                </Link>
              </div>
            ) : null}
          </div>
          <div ref={sentinelRef} aria-hidden className="h-px w-px" />
        </div>
      </header>

      <div className="mx-auto mt-8 flex max-w-6xl flex-col gap-9 px-4 sm:px-6 md:mt-12 md:gap-12">
        {mode === "guest" ? (
          <section
            aria-labelledby="guest-profile-heading"
            className="taste-rise rounded-2xl border border-border bg-card/60 p-5 sm:p-6"
            style={rise(section++)}
          >
            <h2 id="guest-profile-heading" className="text-balance text-lg font-semibold tracking-tight">
              You&apos;re using Slate as a guest
            </h2>
            <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">
              Sign up free to keep your slate, pick a Top 4 and get a profile you can share.
            </p>
            <SignupActions className="mt-5" analyticsArea="profile_guest" />
          </section>
        ) : null}

        <div className="flex flex-col gap-9 md:flex-row md:gap-12">
          {/* Top 4 */}
          {mode === "guest" || (visitor && !top.length) ? null : (
            <section
              aria-labelledby="taste-top"
              className="taste-rise flex min-w-0 flex-col gap-3 md:flex-[1.6]"
              style={rise(section++)}
            >
              {top.length || !owner ? (
                <SectionHead
                  id="taste-top"
                  title={owner && suggested ? "Top 4 · picked for you" : "Top 4"}
                  aside={
                    owner ? (
                      <button
                        type="button"
                        onClick={() => setPickerOpen(true)}
                        className="shrink-0 rounded-md text-[13px] font-medium text-primary transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        {suggested ? "Make it yours" : "Edit"}
                      </button>
                    ) : null
                  }
                />
              ) : (
                <div className="flex flex-col gap-1">
                  <h2 id="taste-top" className="text-[17px] font-semibold tracking-[-0.02em]">
                    Pick your Top 4
                  </h2>
                  <p className="text-sm leading-snug text-muted-foreground">
                    Four films or shows that say something about you. The first one becomes your backdrop.
                  </p>
                </div>
              )}
              <ol className="grid grid-cols-4 gap-2 pb-5 sm:gap-4 sm:pb-7">
                {Array.from({ length: 4 }, (_, index) => {
                  const poster = top[index];
                  if (!poster) {
                    if (!owner) return null;
                    return (
                      <li key={`empty-${index}`} className="taste-deal" style={rise(index)}>
                        <button
                          type="button"
                          onClick={() => setPickerOpen(true)}
                          aria-label={`Pick your number ${index + 1}`}
                          className={cn(
                            "grid aspect-[2/3] w-full place-items-center rounded-[10px] border-[1.5px] border-dashed transition-[background-color,border-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:rounded-[14px]",
                            index === top.length
                              ? "border-primary/55 bg-primary/[0.06] text-primary hover:bg-primary/10"
                              : "border-foreground/15 text-muted-foreground hover:border-foreground/30",
                          )}
                        >
                          <span aria-hidden className="text-xl leading-none">+</span>
                        </button>
                      </li>
                    );
                  }
                  const anchor = `taste-top-${poster.id}`;
                  return (
                    <li key={poster.id} className="taste-deal relative min-w-0" style={rise(index)}>
                      <button
                        id={anchor}
                        type="button"
                        onClick={() => open(poster, anchor)}
                        aria-label={`Number ${index + 1}: ${poster.title}`}
                        className="taste-poster block w-full rounded-[10px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:rounded-[14px]"
                      >
                        <Poster
                          poster={poster}
                          sizes="(min-width: 768px) 160px, 25vw"
                          className="rounded-[10px] shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.08),0_14px_30px_-16px_rgb(0_0_0/0.7)] sm:rounded-[14px]"
                        />
                      </button>
                      <span aria-hidden className="taste-rank">{index + 1}</span>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          {/* Hours and the shelves */}
          {empty ? null : (
            <section
              aria-labelledby="taste-hours"
              className="taste-rise flex min-w-0 flex-col gap-4 md:flex-1 md:pt-7"
              style={rise(section++)}
            >
              <h2 id="taste-hours" className="sr-only">Time spent watching</h2>
              <div className="flex flex-col gap-1">
                <p className="text-[3.5rem] font-semibold leading-[0.95] tracking-[-0.06em] md:text-[4.5rem]">
                  <Count value={taste.hours} />
                  <span className="text-2xl font-medium tracking-[-0.03em] text-muted-foreground md:text-[1.625rem]">
                    {taste.hours === 1 ? " hour" : " hours"}
                  </span>
                </p>
                {taste.hours >= 24 || taste.hoursThisYear ? (
                  <p className="text-sm text-muted-foreground">
                    {taste.hours >= 24 ? `About ${plural(Math.round(taste.hours / 24), "day", "days")} of watching.` : null}
                    {taste.hoursThisYear ? ` ${plural(taste.hoursThisYear, "hour", "hours")} this year.` : null}
                  </p>
                ) : null}
              </div>
              <nav
                aria-label={visitor ? `${displayName}'s shelves` : "Your shelves"}
                className="grid grid-cols-4 border-y border-border/70 md:grid-cols-2"
              >
                {(
                  [
                    { label: "Watched", value: taste.counts.watched, href: shelfHrefs.watched },
                    { label: "Watching", value: taste.counts.watching, href: shelfHrefs.watching },
                    { label: "Up next", value: taste.counts.upNext, href: shelfHrefs.want },
                    { label: "Lists", value: taste.counts.lists, href: listsHref },
                  ] as const
                ).map((count, index) => {
                  const body = (
                    <>
                      <Count value={count.value} className="text-[1.375rem] font-semibold leading-none tracking-[-0.04em] md:text-[1.625rem]" />
                      <span className="text-xs text-muted-foreground transition-colors duration-150 group-hover:text-foreground md:text-[13px]">
                        {count.label}
                      </span>
                    </>
                  );
                  const cell = cn(
                    "group flex min-w-0 flex-col gap-1.5 py-4",
                    index > 0 && "border-l border-border/70 pl-3",
                    "md:border-l-0 md:pl-0",
                    index > 1 && "md:border-t md:border-border/70",
                  );
                  return count.href ? (
                    <Link
                      key={count.label}
                      href={count.href}
                      className={cn(cell, "outline-none focus-visible:bg-accent/60")}
                    >
                      {body}
                    </Link>
                  ) : (
                    <div key={count.label} className={cell}>
                      {body}
                    </div>
                  );
                })}
              </nav>
            </section>
          )}
        </div>

        {empty && mode !== "visitor" ? (
          <section
            aria-labelledby="taste-start"
            className="taste-rise flex flex-col gap-3.5 rounded-[20px] border border-border/70 bg-card p-[18px] md:max-w-xl"
            style={rise(section++)}
          >
            <h2 id="taste-start" className="sr-only">Start your slate</h2>
            <p className="flex items-baseline gap-1.5 text-muted-foreground/60">
              <span className="text-[2.5rem] font-semibold leading-none tracking-[-0.06em]">0</span>
              <span className="text-lg font-medium">hours</span>
            </p>
            <p className="text-sm leading-snug text-muted-foreground">
              Mark something as watched and your hours, genres and year start filling in here.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Link href="/import" className={cn(pillButton, "border border-border bg-background hover:bg-accent")}>
                Import history
              </Link>
              <Link href="/discover" className={cn(pillButton, "bg-primary font-semibold text-primary-foreground hover:bg-primary/90")}>
                Find a title
              </Link>
            </div>
          </section>
        ) : null}

        {taste && (taste.watching.length || taste.recent.length) ? (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-9 md:grid-cols-2 md:gap-12">
            {taste.watching.length ? (
              <section aria-labelledby="taste-now" className="taste-rise flex min-w-0 flex-col gap-3" style={rise(section++)}>
                <SectionHead id="taste-now" title="Watching now" />
                <ul className="flex flex-col gap-2">
                  {taste.watching.map((poster) => {
                    const anchor = `taste-now-${poster.id}`;
                    return (
                      <li key={poster.id}>
                        <button
                          id={anchor}
                          type="button"
                          onClick={() => open(poster, anchor)}
                          className="flex w-full items-center gap-3.5 rounded-[18px] border border-border/70 bg-card p-3 text-left transition-[background-color,transform] duration-150 hover:bg-accent/60 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <Poster poster={poster} sizes="48px" className="w-12 shrink-0 rounded-lg [&>span:first-child]:hidden" />
                          <span className="flex min-w-0 flex-1 flex-col gap-2">
                            <span className="truncate text-[15px] font-semibold tracking-[-0.01em]">{poster.title}</span>
                            {poster.progressLabel ? (
                              <span className="text-[13px] text-muted-foreground">{poster.progressLabel}</span>
                            ) : null}
                            {poster.progress != null ? (
                              <span className="h-1 overflow-hidden rounded-full bg-foreground/10">
                                <span
                                  className="taste-progress block h-full origin-left rounded-full bg-primary"
                                  style={{ transform: `scaleX(${poster.progress})` }}
                                />
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}

            {taste.recent.length ? (
              <section aria-labelledby="taste-recent" className="taste-rise flex min-w-0 flex-col gap-3" style={rise(section++)}>
                <SectionHead
                  id="taste-recent"
                  title="Recently watched"
                  aside={
                    owner ? (
                      <Link href="/watched" className="rounded-md text-[13px] font-medium text-primary hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                        All watched
                      </Link>
                    ) : null
                  }
                />
                <ul className="grid grid-cols-4 gap-2 sm:gap-3">
                  {taste.recent.map((poster) => {
                    const anchor = `taste-recent-${poster.id}`;
                    return (
                      <li key={poster.id} className="flex min-w-0 flex-col gap-1.5">
                        <button
                          id={anchor}
                          type="button"
                          onClick={() => open(poster, anchor)}
                          aria-label={poster.title}
                          className="taste-poster rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <Poster poster={poster} sizes="(min-width: 768px) 110px, 22vw" className="rounded-lg" />
                        </button>
                        {poster.rating === 3 || poster.rating === 2 ? (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            {poster.rating === 3 ? (
                              <Heart aria-hidden className="h-3 w-3 fill-primary text-primary" />
                            ) : (
                              <ThumbsUp aria-hidden className="h-3 w-3 text-primary" />
                            )}
                            {poster.rating === 3 ? "Loved" : "Liked"}
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
          </div>
        ) : null}

        {taste && watchedAny ? (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-9 md:grid-cols-3 md:gap-8">
            {taste.genres.length ? (
              <section aria-labelledby="taste-genres" className="taste-rise flex flex-col gap-3.5" style={rise(section++)}>
                <SectionHead
                  id="taste-genres"
                  title={visitor ? "What they watch" : "What you watch"}
                  aside={
                    <span className="text-xs text-muted-foreground">
                      {plural(taste.films, "film", "films")}, {plural(taste.shows, "show", "shows")}
                    </span>
                  }
                />
                <ul className="flex flex-col gap-2.5">
                  {taste.genres.map((genre, index) => (
                    <li
                      key={genre.name}
                      className="grid min-h-6 grid-cols-[5.25rem_minmax(0,1fr)_2.25rem] items-center gap-2.5"
                    >
                      <span className="truncate text-sm">{genre.name}</span>
                      <span className="h-2.5 overflow-hidden rounded-full bg-foreground/[0.06]">
                        <span
                          className="taste-bar-fill block h-full origin-left rounded-full bg-primary"
                          style={
                            {
                              transform: `scaleX(${genre.share / taste.genres[0].share})`,
                              opacity: 1 - index * 0.14,
                              "--i": index,
                            } as React.CSSProperties
                          }
                        />
                      </span>
                      <span className="text-right text-xs tabular-nums text-muted-foreground">{percent(genre.share)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {taste.ratings ? (
              <section aria-labelledby="taste-ratings" className="taste-rise flex flex-col gap-3" style={rise(section++)}>
                <SectionHead
                  id="taste-ratings"
                  title={visitor ? "How they rate" : "How you rate"}
                  aside={<span className="text-xs font-medium text-primary">{taste.ratings.verdict}</span>}
                />
                <div className="flex h-9 gap-[3px]" role="img" aria-label={`Loved ${percent(taste.ratings.loved)}, liked ${percent(taste.ratings.liked)}, disliked ${percent(taste.ratings.disliked)}`}>
                  {taste.ratings.loved > 0 ? (
                    <span
                      className="flex min-w-0 items-center overflow-hidden whitespace-nowrap rounded-l-[10px] rounded-r bg-primary pl-2.5 text-xs font-semibold text-primary-foreground"
                      style={{ flex: `${taste.ratings.loved} 1 0` }}
                    >
                      {taste.ratings.loved >= 0.18 ? `Loved ${percent(taste.ratings.loved)}` : null}
                    </span>
                  ) : null}
                  {taste.ratings.liked > 0 ? (
                    <span
                      className={cn(
                        "flex min-w-0 items-center overflow-hidden whitespace-nowrap rounded bg-primary/40 pl-2.5 text-xs font-medium",
                        !taste.ratings.loved && "rounded-l-[10px]",
                        !taste.ratings.disliked && "rounded-r-[10px]",
                      )}
                      style={{ flex: `${taste.ratings.liked} 1 0` }}
                    >
                      {taste.ratings.liked >= 0.18 ? `Liked ${percent(taste.ratings.liked)}` : null}
                    </span>
                  ) : null}
                  {taste.ratings.disliked > 0 ? (
                    <span
                      className="rounded-l rounded-r-[10px] bg-foreground/10"
                      style={{ flex: `${taste.ratings.disliked} 1 0` }}
                    />
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {taste.ratings.disliked ? `Disliked ${percent(taste.ratings.disliked)}. ` : ""}
                  From {plural(taste.ratings.rated, "rating", "ratings")}.
                </p>
              </section>
            ) : null}

            <section aria-labelledby="taste-year" className="taste-rise flex flex-col gap-3" style={rise(section++)}>
              <SectionHead
                id="taste-year"
                title={String(taste.year.year)}
                aside={<span className="text-xs text-muted-foreground">{plural(taste.year.total, "watched", "watched")}</span>}
              />
              <div
                className="grid h-16 grid-cols-12 items-end gap-[5px]"
                role="img"
                aria-label={`Titles watched each month of ${taste.year.year}: ${taste.year.months.join(", ")}`}
              >
                {taste.year.months.map((count, index) => {
                  const most = Math.max(1, ...taste.year.months);
                  const current = index === new Date().getUTCMonth();
                  return (
                    <span
                      key={index}
                      className={cn(
                        "taste-month block h-full origin-bottom rounded-[3px]",
                        count === 0 ? "bg-foreground/[0.06]" : current ? "bg-primary" : "bg-primary/35",
                      )}
                      style={
                        {
                          transform: `scaleY(${count === 0 ? 0.05 : count / most})`,
                          "--i": index,
                        } as React.CSSProperties
                      }
                    />
                  );
                })}
              </div>
              <div aria-hidden className="grid grid-cols-12 gap-[5px] text-center text-[10px] text-muted-foreground">
                {MONTHS.map((month, index) => (
                  <span key={index}>{month}</span>
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {taste && taste.total > 0 ? (
          <Link
            href={spaceHref}
            className="taste-rise group flex items-center gap-3.5 rounded-[20px] border border-border/70 bg-card p-4 transition-[background-color,transform] duration-150 hover:bg-accent/60 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:p-6"
            style={rise(section++)}
          >
            <span aria-hidden className="grid grid-cols-3 gap-[3px]">
              {[0, 1, 2].map((index) => {
                const poster = taste.recent[index] ?? taste.top[index];
                const src = poster ? posterUrl(poster.posterPath, "w92") : null;
                return (
                  <span key={index} className="relative block h-[26px] w-[18px] overflow-hidden rounded bg-foreground/10">
                    {src ? <Image src={src} alt="" fill sizes="18px" className="object-cover" /> : null}
                  </span>
                );
              })}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-semibold md:text-[17px]">
                {visitor ? "See everything in Space" : "Browse the whole slate"}
              </span>
              <span className="text-[13px] text-muted-foreground md:text-sm">
                {visitor
                  ? `The full wall of ${displayName}'s ${plural(taste.total, "title", "titles")}.`
                  : `${plural(taste.total, "title", "titles")} in Space.`}
              </span>
            </span>
            <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" />
          </Link>
        ) : null}

        {visitor && empty ? (
          <section className="taste-rise flex flex-col items-start gap-3 rounded-[20px] border border-border/70 bg-card p-5" style={rise(section++)}>
            <Film aria-hidden className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {displayName} hasn&apos;t added anything yet. Check back soon.
            </p>
          </section>
        ) : null}
      </div>

      {openTitle ? (
        <CollectionTitleDetailOverlay
          key={openTitle.row.id}
          title={openTitle.row}
          detailSource={detailSource}
          anchorElementId={openTitle.anchor}
          scrollContainerId={visitor ? undefined : "app-scroll-area"}
          renderActions={(title, detail) =>
            visitor ? (
              <PublicProfileTitleActions
                title={title}
                detail={detail}
                username={username}
                viewerSignedIn={viewerSignedIn}
              />
            ) : owner ? (
              <LibraryTitleActions title={title} lists={lists} onRemoved={close} />
            ) : null
          }
          onClose={close}
        />
      ) : null}

      {owner ? (
        <ProfileTopPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          initial={top.map((poster) => poster.id)}
          candidates={candidates}
        />
      ) : null}
    </div>
  );
}
