"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Box,
  Ellipsis,
  Film,
  LayoutGrid,
  Plus,
  Search,
  Sparkles,
  Settings,
  Share2,
  Upload,
  X,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { LibraryTitleActions } from "@/components/library-title-actions";
import { MediaGrid, type MediaGridReorderContext } from "@/components/media-grid";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCommandPalette } from "@/components/command-palette";
import {
  CollectionTitleDetailOverlay,
  type SpatialCameraState,
  type TitleDetailSource,
} from "@/components/spatial-poster-grid";
import { extractGenres, filterAndSort } from "@/lib/filter-utils";
import {
  getCachedLibraryTitleDetail,
  loadLibraryTitleDetail,
} from "@/lib/library-title-detail-cache";
import { cn } from "@/lib/utils";
import type { TitleRow } from "@/lib/types";
import { APP_ROOT } from "@/lib/public-mode";

const loadSpatialPosterGrid = () => import("@/components/spatial-poster-grid");

const SpatialPosterGrid = dynamic(
  () => loadSpatialPosterGrid().then((module) => module.SpatialPosterGrid),
  {
    ssr: false,
    loading: () => (
      <div className="relative grid h-full w-full place-items-center overflow-hidden bg-background">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.1),transparent_46%)]" />
        <div className="relative flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          Opening Space
        </div>
      </div>
    ),
  },
);

type ViewMode = "shelf" | "space";
type ResultsTransitionPhase = "idle" | "fading-out" | "fading-in";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "want", label: "Up Next" },
  { value: "watching", label: "Watching" },
  { value: "watched", label: "Watched" },
] as const;

interface LibraryCollectionViewProps {
  titles: TitleRow[];
  displayName: string;
  avatarUrl: string | null;
  lists: { id: string; name: string }[];
}

function ViewSwitcher({
  mode,
  disabled,
  onSelect,
}: {
  mode: ViewMode;
  disabled: boolean;
  onSelect: (mode: ViewMode) => void;
}) {
  return (
    <div
      className="relative grid h-10 w-[5.25rem] shrink-0 grid-cols-2 rounded-full border border-border bg-foreground/[0.055] p-0.5"
      role="group"
      aria-label="Library view"
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute bottom-0.5 left-0.5 top-0.5 w-[calc(50%-0.125rem)] rounded-full shadow-[0_1px_8px_rgba(0,0,0,0.18)] transition-[transform,background-color] duration-[240ms] ease-[cubic-bezier(0.65,0,0.35,1)]",
          mode === "shelf"
            ? "translate-x-0 bg-primary"
            : "translate-x-full bg-primary",
        )}
      />
      <button
        type="button"
        onClick={() => onSelect("shelf")}
        aria-pressed={mode === "shelf"}
        aria-label="Shelf view"
        disabled={disabled}
        className={cn(
          "relative z-10 inline-flex w-10 items-center justify-center rounded-full outline-none transition-[color,transform] duration-200 ease-[cubic-bezier(0.65,0,0.35,1)] active:scale-[0.97] focus-visible:ring-1 focus-visible:ring-primary/60 disabled:pointer-events-none",
          mode === "shelf"
            ? "text-primary-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onSelect("space")}
        aria-pressed={mode === "space"}
        aria-label="Space view"
        disabled={disabled}
        className={cn(
          "relative z-10 inline-flex w-10 items-center justify-center rounded-full outline-none transition-[color,transform] duration-200 ease-[cubic-bezier(0.65,0,0.35,1)] active:scale-[0.97] focus-visible:ring-1 focus-visible:ring-primary/60 disabled:pointer-events-none",
          mode === "space"
            ? "text-primary-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Box className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function OwnerMenu({
  avatarUrl,
  displayName,
}: {
  avatarUrl: string | null;
  displayName: string;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Open profile menu"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-foreground/[0.055] text-muted-foreground transition-[border-color,background-color,color,transform] duration-150 hover:border-foreground/20 hover:bg-foreground/[0.09] hover:text-foreground active:scale-[0.97]"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover md:hidden"
            />
          ) : (
            <span className="grid h-full w-full place-items-center text-xs font-semibold text-foreground/75 md:hidden">
              {displayName.slice(0, 1).toLocaleUpperCase()}
            </span>
          )}
          <Ellipsis className="hidden h-4 w-4 md:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="z-[90] w-48 border-border bg-popover/96 p-1.5 text-popover-foreground shadow-[0_24px_70px_-24px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
      >
        <DropdownMenuItem asChild className="gap-2 rounded-lg focus:bg-accent">
          <Link href="/import">
            <Upload className="h-3.5 w-3.5 text-muted-foreground" />
            Import
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="gap-2 rounded-lg focus:bg-accent">
          <Link href="/share">
            <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
            Share your profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="gap-2 rounded-lg focus:bg-accent">
          <Link href="/profile">
            <Settings className="h-3.5 w-3.5 text-muted-foreground" />
            Settings
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SmoothShelfResults({
  titles,
  transitionKey,
  selectedTitleId,
  onTitleSelect,
  reorderContext,
}: {
  titles: TitleRow[];
  /** Changes only when the user changes the visible filter/query. */
  transitionKey: string;
  selectedTitleId: string | null;
  onTitleSelect: (title: TitleRow) => void;
  reorderContext?: MediaGridReorderContext;
}) {
  const reducedMotion = useReducedMotion() ?? false;
  const [renderedTitles, setRenderedTitles] = React.useState(titles);
  const incomingSignature = titles
    .map((title) =>
      [title.id, title.status, title.rating ?? "", title.review ?? ""].join(":"),
    )
    .join("|");
  const [renderedSignature, setRenderedSignature] =
    React.useState(incomingSignature);
  const [renderedTransitionKey, setRenderedTransitionKey] =
    React.useState(transitionKey);
  const [phase, setPhase] =
    React.useState<ResultsTransitionPhase>("idle");
  const pendingTitles = React.useRef(titles);
  const pendingTransitionKey = React.useRef(transitionKey);

  React.useEffect(() => {
    pendingTitles.current = titles;
    pendingTransitionKey.current = transitionKey;
  }, [titles, transitionKey]);

  React.useEffect(() => {
    if (reducedMotion) {
      setRenderedTitles(pendingTitles.current);
      setRenderedSignature(incomingSignature);
      setRenderedTransitionKey(transitionKey);
      setPhase("idle");
      return;
    }

    // A save, status update, or background refresh is a data reconciliation,
    // not a new result set. Keep the existing surface fully opaque and let
    // React reconcile the changed cards in place.
    if (transitionKey === renderedTransitionKey) {
      if (incomingSignature === renderedSignature) return;
      setRenderedTitles(pendingTitles.current);
      setRenderedSignature(incomingSignature);
      setPhase("idle");
      return;
    }

    // Different controls can occasionally resolve to the same titles. There
    // is nothing visual to transition in that case.
    if (incomingSignature === renderedSignature) {
      setRenderedTransitionKey(transitionKey);
      setPhase("idle");
      return;
    }

    setPhase("fading-out");
  }, [
    incomingSignature,
    reducedMotion,
    renderedSignature,
    renderedTransitionKey,
    transitionKey,
  ]);

  const handleComplete = React.useCallback(() => {
    if (phase === "fading-out") {
      setRenderedTitles(pendingTitles.current);
      setRenderedSignature(
        pendingTitles.current
          .map((title) =>
            [title.id, title.status, title.rating ?? "", title.review ?? ""].join(
              ":",
            ),
          )
          .join("|"),
      );
      setRenderedTransitionKey(pendingTransitionKey.current);
      setPhase("fading-in");
    } else if (phase === "fading-in") {
      setPhase("idle");
    }
  }, [phase]);

  return (
    <motion.div
      initial={false}
      animate={{
        opacity: phase === "fading-out" ? 0.28 : 1,
        y: phase === "fading-out" ? 3 : 0,
      }}
      transition={{
        duration: reducedMotion ? 0 : phase === "fading-out" ? 0.13 : 0.21,
        ease: phase === "fading-out" ? [0.4, 0, 1, 1] : [0.16, 1, 0.3, 1],
      }}
      onAnimationComplete={handleComplete}
      className="will-change-[opacity,transform]"
      style={{ pointerEvents: phase === "idle" ? "auto" : "none" }}
    >
      {renderedTitles.length ? (
        <MediaGrid
          titles={renderedTitles}
          reorderContext={reorderContext}
          compactMobile
          presentation="profile"
          showCardActions={false}
          animateEntrance={false}
          activeTitleId={selectedTitleId}
          onTitleSelect={onTitleSelect}
        />
      ) : (
        <EmptyState
          icon={<Film className="h-6 w-6" />}
          title="No titles match"
          description="Try another filter or search."
        />
      )}
    </motion.div>
  );
}

export function LibraryCollectionView({
  titles,
  displayName,
  avatarUrl,
  lists,
}: LibraryCollectionViewProps) {
  const searchParams = useSearchParams();
  const {
    open: openCommandPalette,
    openWith: openSmartSearch,
    aiEnabled,
  } = useCommandPalette();
  const reducedMotion = useReducedMotion() ?? false;
  const [query, setQuery] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchTarget, setSearchTarget] = React.useState<{
    titleId: string;
    request: number;
  } | null>(null);
  const [spatialCamera, setSpatialCamera] = React.useState<SpatialCameraState>({
    x: 0,
    y: 0,
    scale: 0.88,
  });
  const [mode, setMode] = React.useState<ViewMode>(() =>
    searchParams.get("view") === "space" ? "space" : "shelf",
  );
  const [isSwitching, setIsSwitching] = React.useState(false);
  const [shelfTitle, setShelfTitle] = React.useState<TitleRow | null>(null);
  const searchRequestRef = React.useRef(0);
  const switchTimerRef = React.useRef<number | null>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const status = searchParams.get("status") ?? "";
  const activeStatus =
    status === "want" || status === "watching" || status === "watched"
      ? status
      : null;
  const filterParams = React.useMemo(
    () => ({
      type: searchParams.get("type") ?? undefined,
      genre: searchParams.get("genre") ?? undefined,
      year: searchParams.get("year") ?? undefined,
      sort: mode === "shelf" ? (searchParams.get("sort") ?? undefined) : undefined,
      sentiment:
        activeStatus === "watched"
          ? (searchParams.get("sentiment") ?? undefined)
          : undefined,
    }),
    [activeStatus, mode, searchParams],
  );
  const filterTransitionKey = React.useMemo(
    () =>
      [
        activeStatus ?? "all",
        filterParams.type ?? "",
        filterParams.genre ?? "",
        filterParams.year ?? "",
        filterParams.sort ?? "",
        filterParams.sentiment ?? "",
      ].join("\u001f"),
    [activeStatus, filterParams],
  );
  const shelfTransitionKey = React.useMemo(
    () => `${filterTransitionKey}\u001f${normalizedQuery}`,
    [filterTransitionKey, normalizedQuery],
  );
  const filteredTitles = React.useMemo(() => {
    const scopedTitles = activeStatus
      ? titles.filter((title) => title.status === activeStatus)
      : titles;
    return filterAndSort(scopedTitles, activeStatus ?? "all", filterParams);
  }, [activeStatus, filterParams, titles]);
  const visibleShelfTitles = React.useMemo(
    () =>
      normalizedQuery
        ? filteredTitles.filter((title) =>
            `${title.title} ${title.original_title ?? ""}`
              .toLocaleLowerCase()
              .includes(normalizedQuery),
          )
        : filteredTitles,
    [filteredTitles, normalizedQuery],
  );
  const matches = React.useMemo(() => {
    if (!normalizedQuery) return [];
    return filteredTitles
      .filter((title) =>
        `${title.title} ${title.original_title ?? ""}`
          .toLocaleLowerCase()
          .includes(normalizedQuery),
      )
      .slice(0, 6);
  }, [filteredTitles, normalizedQuery]);
  const genres = React.useMemo(() => extractGenres(titles), [titles]);
  const titleDetailSource = React.useMemo<TitleDetailSource>(
    () => ({
      getCached: (title) => getCachedLibraryTitleDetail(title.id),
      load: (title) => loadLibraryTitleDetail(title.id),
    }),
    [],
  );
  const statusOrder = React.useMemo(
    () => ({
      want: titles.filter((title) => title.status === "want").map((title) => title.id),
      watching: titles
        .filter((title) => title.status === "watching")
        .map((title) => title.id),
      watched: titles
        .filter((title) => title.status === "watched")
        .map((title) => title.id),
    }),
    [titles],
  );
  const reorderContext = React.useMemo<MediaGridReorderContext | undefined>(
    () =>
      mode === "shelf" && activeStatus && !filterParams.sort
        ? {
            kind: "status",
            status: activeStatus,
            allTitleIds: statusOrder[activeStatus],
          }
        : undefined,
    [activeStatus, filterParams.sort, mode, statusOrder],
  );

  const closeShelfTitle = React.useCallback(() => {
    setShelfTitle(null);
  }, []);
  const renderActions = React.useCallback(
    (title: TitleRow) => (
      <LibraryTitleActions
        title={title}
        lists={lists}
        onRemoved={closeShelfTitle}
      />
    ),
    [closeShelfTitle, lists],
  );

  const focusTitle = React.useCallback((titleId: string) => {
    searchRequestRef.current += 1;
    setSearchTarget({ titleId, request: searchRequestRef.current });
  }, []);

  const openShelfTitle = React.useCallback(
    (title: TitleRow) => {
      void titleDetailSource.load(title).catch(() => undefined);
      setShelfTitle(title);
    },
    [titleDetailSource],
  );

  const selectSearchResult = React.useCallback(
    (title: TitleRow) => {
      setSearchOpen(false);
      if (mode === "space") focusTitle(title.id);
      else openShelfTitle(title);
    },
    [focusTitle, mode, openShelfTitle],
  );

  const openExpandedSearch = React.useCallback(
    (nextMode: "search" | "ask") => {
      openSmartSearch({
        initialQuery: query,
        mode: nextMode,
        submit: nextMode === "ask" && Boolean(normalizedQuery),
        onLibrarySelect: (selection) => {
          const selected = titles.find(
            (title) =>
              title.id === selection.id ||
              (title.tmdb_id === selection.tmdbId &&
                title.media_type === selection.mediaType),
          );
          if (selected) {
            // A cast/crew query usually does not contain the selected title's
            // name. Clear the inline filter before opening so the poster is
            // present for Shelf anchoring (and visible in Space).
            setQuery("");
            selectSearchResult(selected);
          }
        },
      });
      setSearchOpen(false);
    },
    [normalizedQuery, openSmartSearch, query, selectSearchResult, titles],
  );

  const selectMode = React.useCallback(
    (nextMode: ViewMode) => {
      if (nextMode === mode || isSwitching) return;
      setIsSwitching(true);
      setSearchOpen(false);
      closeShelfTitle();
      const params = new URLSearchParams(window.location.search);
      if (nextMode === "space") params.set("view", "space");
      else params.delete("view");
      const nextSearch = params.toString();
      window.history.replaceState(
        null,
        "",
        nextSearch
          ? `${window.location.pathname}?${nextSearch}`
          : window.location.pathname,
      );
      switchTimerRef.current = window.setTimeout(
        () => {
          setMode(nextMode);
          if (nextMode === "shelf") setSearchTarget(null);
          switchTimerRef.current = null;
        },
        reducedMotion ? 0 : 110,
      );
    },
    [closeShelfTitle, isSwitching, mode, reducedMotion],
  );

  React.useEffect(() => {
    void loadSpatialPosterGrid();
    return () => {
      if (switchTimerRef.current !== null) {
        window.clearTimeout(switchTimerRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (!isSwitching || switchTimerRef.current !== null) return;
    const frame = window.requestAnimationFrame(() => setIsSwitching(false));
    return () => window.cancelAnimationFrame(frame);
  }, [isSwitching, mode]);

  React.useEffect(() => {
    if (shelfTitle && !titles.some((title) => title.id === shelfTitle.id)) {
      closeShelfTitle();
    }
  }, [closeShelfTitle, shelfTitle, titles]);

  return (
    <div
      data-library-collection
      className={cn(
        "flex min-h-full w-full flex-col bg-background text-foreground md:min-h-dvh",
        mode === "space" && "h-full",
      )}
    >
      <header
        id="library-collection-controls"
        className="pointer-events-none sticky inset-x-0 top-0 z-50 shrink-0 px-2.5 pb-7 text-foreground min-[380px]:px-3 md:px-5 md:pb-6 lg:px-8 xl:px-10"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        aria-label="Your slate controls"
      >
        <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, hsl(var(--background) / 0.98) 0%, hsl(var(--background) / 0.9) 54%, hsl(var(--background) / 0.54) 76%, hsl(var(--background) / 0) 100%)",
            }}
          />
          <div
            className="absolute inset-0 backdrop-blur-2xl"
            style={{
              WebkitMaskImage:
                "linear-gradient(to bottom, black 0%, black 48%, rgba(0,0,0,0.72) 68%, transparent 100%)",
              maskImage:
                "linear-gradient(to bottom, black 0%, black 48%, rgba(0,0,0,0.72) 68%, transparent 100%)",
            }}
          />
        </div>

        <div className="pointer-events-auto grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-x-1.5 lg:gap-x-2.5 xl:gap-x-5">
          <Link
            href={APP_ROOT}
            aria-label="slate home"
            className="col-start-1 row-start-1 inline-flex items-center pl-0.5 outline-none transition-opacity hover:opacity-82 focus-visible:ring-1 focus-visible:ring-primary/60"
          >
            <Image
              src="/brand/logo-light.svg"
              alt="slate"
              width={62}
              height={17}
              loading="eager"
              className="hidden dark:block"
            />
            <Image
              src="/brand/logo-dark.svg"
              alt="slate"
              width={62}
              height={17}
              loading="eager"
              className="dark:hidden"
            />
          </Link>

          <div className="col-span-2 col-start-1 row-start-2 flex min-w-0 flex-wrap items-center gap-2 md:col-span-1 md:col-start-2 md:row-start-1 md:w-full md:flex-nowrap md:justify-self-center md:justify-center md:gap-1.5 lg:gap-2 xl:gap-2.5 min-[1600px]:max-w-[80rem]">
            <div
              className="relative w-full min-w-0 md:max-[1100px]:w-10 md:max-[1100px]:shrink-0 min-[1100px]:w-[clamp(8rem,12vw,10rem)] min-[1100px]:shrink min-[1400px]:min-w-10 min-[1400px]:w-[clamp(10rem,18vw,20rem)]"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setSearchOpen(false);
                }
              }}
            >
              <button
                type="button"
                onClick={() => openExpandedSearch("search")}
                aria-label="Open smart search"
                className="hidden h-10 w-10 items-center justify-center rounded-full border border-border bg-foreground/[0.065] text-muted-foreground transition-[border-color,background-color,color,transform] duration-150 hover:border-primary/45 hover:bg-primary/10 hover:text-primary active:scale-[0.96] md:max-[1100px]:inline-flex"
              >
                <Search className="h-4 w-4" />
              </button>
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => {
                  if (normalizedQuery) setSearchOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                  event.preventDefault();
                  if (matches[0]) selectSearchResult(matches[0]);
                  else openExpandedSearch("search");
                }}
                placeholder="Search titles, people, or ask"
                aria-label="Search your slate, discover titles, or ask"
                className={cn(
                  "h-10 w-full appearance-none rounded-2xl border border-border bg-foreground/[0.065] pl-4 text-sm text-foreground outline-none transition-[border-color,background-color] duration-150 placeholder:text-muted-foreground focus:border-primary/55 focus:bg-foreground/[0.09] sm:rounded-full [&::-webkit-search-cancel-button]:hidden",
                  aiEnabled
                    ? query
                      ? "pr-28 min-[1400px]:pr-40"
                      : "pr-20 min-[1400px]:pr-32"
                    : "pr-20",
                  "md:max-[1100px]:hidden",
                )}
              />
              <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1 md:max-[1100px]:hidden">
                {query ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setSearchOpen(false);
                      setSearchTarget(null);
                    }}
                    className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-[color,background-color,transform] duration-150 hover:bg-foreground/10 hover:text-foreground active:scale-[0.96]"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                {aiEnabled ? (
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => openExpandedSearch("ask")}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-foreground/[0.075] text-muted-foreground transition-[border-color,background-color,color,transform] duration-150 hover:border-primary/45 hover:bg-primary/10 hover:text-primary active:scale-[0.97] min-[1400px]:w-auto min-[1400px]:gap-1.5 min-[1400px]:px-2.5 min-[1400px]:text-[11px] min-[1400px]:font-medium"
                    aria-label="Ask"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span className="hidden min-[1400px]:inline">Ask</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => openExpandedSearch("search")}
                  className="grid h-8 w-8 place-items-center rounded-full bg-foreground/10 text-foreground transition-[background-color,color,transform] duration-150 hover:bg-primary hover:text-primary-foreground active:scale-[0.96]"
                  aria-label="Search titles and people"
                >
                  <Search className="h-4 w-4" />
                </button>
              </div>

              {normalizedQuery && searchOpen ? (
                <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-10 overflow-hidden rounded-2xl border border-border bg-popover/95 p-1.5 text-popover-foreground shadow-[0_24px_70px_-24px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
                  {matches.length
                    ? matches.map((title) => (
                      <button
                        key={title.id}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectSearchResult(title)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-xs text-foreground/80 transition-[color,background-color,transform] duration-150 hover:bg-accent hover:text-foreground active:scale-[0.99]"
                      >
                        <span className="truncate">{title.title}</span>
                        <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                          {title.status === "want" ? "Up Next" : title.status}
                        </span>
                      </button>
                    ))
                    : null}
                  <div
                    className={cn(
                      matches.length && "mt-1 border-t border-border/70 pt-1",
                    )}
                  >
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => openExpandedSearch("search")}
                      className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-xs text-muted-foreground transition-[color,background-color,transform] duration-150 hover:bg-accent hover:text-foreground active:scale-[0.99]"
                    >
                      <span className="truncate">
                        Search all for &ldquo;{query.trim()}&rdquo;
                      </span>
                      <Search className="h-3.5 w-3.5 shrink-0" />
                    </button>
                    {aiEnabled ? (
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => openExpandedSearch("ask")}
                        className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-xs text-muted-foreground transition-[color,background-color,transform] duration-150 hover:bg-accent hover:text-primary active:scale-[0.99]"
                      >
                        <span className="truncate">
                          Ask about &ldquo;{query.trim()}&rdquo;
                        </span>
                        <Sparkles className="h-3.5 w-3.5 shrink-0" />
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="scrollbar-hide w-full min-w-0 overflow-x-auto overscroll-x-contain pb-1 touch-pan-x md:flex-1 md:pb-0">
              <FilterBar
                genres={genres}
                showSort={mode === "shelf"}
                typeDisplay="menu"
                showSentiment={activeStatus === "watched"}
                sentimentDisplay="menu"
                statusOptions={STATUS_OPTIONS}
                statusParam="status"
                fullHeightStatus
                idPrefix="owned-library"
                popoverClassName="z-[90] border-border bg-popover text-popover-foreground"
                groupControls
                sortPlacement="end"
                className="mb-0 w-max flex-nowrap gap-2 md:gap-1.5 [&_.filter-chip]:h-10 [&_.filter-chip]:border-border [&_.filter-chip]:bg-foreground/[0.065] [&_.filter-chip]:text-muted-foreground [&_.filter-chip:hover]:text-foreground [&_.filter-chip[data-active=true]]:border-primary/50 [&_.filter-chip[data-active=true]]:bg-primary/15 [&_.filter-chip[data-active=true]]:text-primary [&_.filter-segment]:whitespace-nowrap [&_.filter-segment]:px-2.5 [&_.filter-segment:first-child]:px-3.5 [&_.filter-segmented]:h-10 [&_.filter-segmented]:border-border [&_.filter-segmented]:bg-foreground/[0.055] [&_[data-filter-clear]]:px-3 md:[&_.filter-chip]:gap-1 md:[&_.filter-chip]:px-1.5 md:[&_.filter-segment]:px-1.5 md:[&_.filter-segment]:text-[11px] md:[&_.filter-segment:first-child]:px-1.5 md:[&_[data-filter-clear]]:w-10 md:[&_[data-filter-clear]]:justify-center md:[&_[data-filter-clear-label]]:hidden md:max-lg:[&_.filter-chip]:px-1.5 md:max-lg:[&_.filter-chip]:text-[11px] md:max-lg:[&_.filter-chip_.lucide-chevron-down]:hidden md:max-lg:[&_.filter-control-group]:gap-0.5 md:max-lg:[&_.filter-segment]:px-1 md:max-lg:[&_.filter-segment:first-child]:px-1 md:max-lg:[&_[data-filter-sentiment]]:w-10 md:max-lg:[&_[data-filter-sentiment]]:justify-center md:max-lg:[&_[data-filter-sentiment]]:px-0 md:max-lg:[&_[data-filter-sentiment-label]]:hidden md:max-lg:[&_[data-filter-sort]]:w-10 md:max-lg:[&_[data-filter-sort]]:justify-center md:max-lg:[&_[data-filter-sort]]:px-0 md:max-lg:[&_[data-filter-sort-label]]:hidden lg:max-[1400px]:[&_.filter-chip]:px-2 lg:max-[1400px]:[&_.filter-chip]:text-[11px] lg:max-[1400px]:[&_.filter-chip_.lucide-chevron-down]:hidden lg:max-[1400px]:[&_.filter-control-group]:gap-1 lg:max-[1400px]:[&_.filter-segment]:px-1.5 lg:max-[1400px]:[&_.filter-segment:first-child]:px-1.5 lg:max-[1400px]:[&_[data-filter-clear]]:w-10 lg:max-[1400px]:[&_[data-filter-clear]]:px-0 min-[1400px]:[&_.filter-chip]:px-2.5 min-[1400px]:[&_.filter-chip]:text-xs min-[1400px]:[&_.filter-segment]:px-2 min-[1400px]:[&_.filter-segment:first-child]:px-3 min-[1400px]:[&_[data-filter-clear]]:w-auto min-[1400px]:[&_[data-filter-clear-label]]:inline"
              />
            </div>
          </div>

          <div className="col-start-2 row-start-1 flex shrink-0 items-center justify-end gap-1 md:col-start-3 md:gap-1 lg:gap-2 xl:justify-self-end">
            <ViewSwitcher mode={mode} disabled={isSwitching} onSelect={selectMode} />
            <ThemeToggle className="h-10 w-10 shrink-0 border border-border bg-foreground/[0.055] text-muted-foreground hover:bg-foreground/[0.09] hover:text-foreground md:hidden lg:inline-flex" />
            <OwnerMenu
              avatarUrl={avatarUrl}
              displayName={displayName}
            />
          </div>
        </div>
      </header>

      {mode === "shelf" ? (
        <motion.main
          initial={false}
          animate={{ opacity: isSwitching ? 0.16 : 1, y: isSwitching ? 2 : 0 }}
          transition={{
            duration: reducedMotion ? 0 : 0.2,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="w-full flex-1 px-3 pb-12 sm:px-6 md:px-5 lg:px-8 xl:px-10"
        >
          {titles.length ? (
            <SmoothShelfResults
              titles={visibleShelfTitles}
              transitionKey={shelfTransitionKey}
              selectedTitleId={shelfTitle?.id ?? null}
              onTitleSelect={openShelfTitle}
              reorderContext={reorderContext}
            />
          ) : (
            <div className="grid min-h-[48dvh] place-items-center">
              <EmptyState
                icon={<Film className="h-6 w-6" />}
                title="Your slate is empty"
                description="Add the first title you do not want to forget."
                action={
                  <button
                    type="button"
                    onClick={openCommandPalette}
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground transition-transform active:scale-[0.97]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add a title
                  </button>
                }
              />
            </div>
          )}
        </motion.main>
      ) : (
        <motion.div
          role="region"
          aria-label="Space view"
          initial={false}
          animate={{ opacity: isSwitching ? 0.16 : 1, scale: 1 }}
          transition={{
            duration: reducedMotion ? 0 : 0.22,
            ease: [0.65, 0, 0.35, 1],
          }}
          className="relative min-h-0 flex-1 bg-background will-change-[opacity,transform]"
        >
          <SpatialPosterGrid
            titles={filteredTitles}
            resultsTransitionKey={filterTransitionKey}
            detailSource={titleDetailSource}
            renderActions={renderActions}
            onExit={() => selectMode("shelf")}
            searchTarget={searchTarget}
            initialCamera={spatialCamera}
            onCameraChange={setSpatialCamera}
          />
        </motion.div>
      )}

      {shelfTitle ? (
        <CollectionTitleDetailOverlay
          key={shelfTitle.id}
          title={shelfTitle}
          detailSource={titleDetailSource}
          renderActions={renderActions}
          anchorTitleId={shelfTitle.id}
          scrollContainerId="app-scroll-area"
          centerAfterId="library-collection-controls"
          onClose={closeShelfTitle}
        />
      ) : null}
    </div>
  );
}
