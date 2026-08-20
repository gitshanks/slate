"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import {
  Box,
  Film,
  LayoutGrid,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { LibraryTitleActions } from "@/components/library-title-actions";
import { MediaGrid, type MediaGridReorderContext } from "@/components/media-grid";
import {
  OwnedAppToolbar,
  OwnerMenu,
} from "@/components/owned-app-toolbar";
import { ThemeToggle } from "@/components/theme-toggle";
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
  const toolbarSearchRef = React.useRef<HTMLDivElement>(null);
  const toolbarFilterRef = React.useRef<HTMLDivElement>(null);
  const toolbarLeftRef = React.useRef<number | null>(null);
  const toolbarAnimationsRef = React.useRef<Animation[]>([]);
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

  // The visible search + filter cluster stays optically centered when
  // conditional controls (Reaction, Order, Clear) appear or disappear. FLIP
  // that recentering on the two small toolbar surfaces so the change glides
  // instead of jumping, without promoting the poster grid or animating layout.
  React.useLayoutEffect(() => {
    const searchElement = toolbarSearchRef.current;
    const filterElement = toolbarFilterRef.current;
    if (!searchElement || !filterElement) return;

    const nextLeft = searchElement.getBoundingClientRect().left;
    const previousLeft = toolbarLeftRef.current;
    toolbarLeftRef.current = nextLeft;

    toolbarAnimationsRef.current.forEach((animation) => animation.cancel());
    toolbarAnimationsRef.current = [];

    if (
      reducedMotion ||
      previousLeft === null ||
      Math.abs(previousLeft - nextLeft) < 0.5 ||
      typeof searchElement.animate !== "function" ||
      typeof filterElement.animate !== "function"
    ) {
      return;
    }

    const deltaX = previousLeft - nextLeft;
    const keyframes: Keyframe[] = [
      { transform: `translate3d(${deltaX}px, 0, 0)` },
      { transform: "translate3d(0, 0, 0)" },
    ];
    const options: KeyframeAnimationOptions = {
      duration: 200,
      easing: "cubic-bezier(0.32, 0.72, 0, 1)",
    };

    toolbarAnimationsRef.current = [searchElement, filterElement].map(
      (element) => element.animate(keyframes, options),
    );
  }, [
    activeStatus,
    filterParams.genre,
    filterParams.sentiment,
    filterParams.sort,
    filterParams.type,
    filterParams.year,
    mode,
    reducedMotion,
  ]);

  React.useEffect(
    () => () => {
      toolbarAnimationsRef.current.forEach((animation) => animation.cancel());
    },
    [],
  );

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
      <OwnedAppToolbar
        id="library-collection-controls"
        ariaLabel="Your slate controls"
        center={
          <div className="col-span-2 col-start-1 row-start-2 flex min-w-0 flex-wrap items-center gap-2 md:col-span-1 md:col-start-2 md:row-start-1 md:w-full md:flex-nowrap md:justify-self-center md:justify-center md:gap-1.5 lg:gap-2 xl:max-w-[80rem]">
            <div
              ref={toolbarSearchRef}
              className="relative w-full min-w-0 md:w-[clamp(11rem,20vw,13rem)] md:shrink-0 lg:w-[clamp(13rem,18vw,15rem)] xl:w-[clamp(14rem,calc(100vw-78rem),24rem)]"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setSearchOpen(false);
                }
              }}
            >
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
                      ? "pr-28 md:pr-20"
                      : "pr-20"
                    : "pr-20",
                )}
              />
              <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
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
                    className={cn(
                      "inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-foreground/[0.075] text-muted-foreground transition-[border-color,background-color,color,transform] duration-150 hover:border-primary/45 hover:bg-primary/10 hover:text-primary active:scale-[0.97]",
                      query && "md:hidden",
                    )}
                    aria-label="Ask"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
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
                <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-10 overflow-hidden rounded-2xl border border-border bg-popover/95 p-1.5 text-popover-foreground shadow-[0_24px_70px_-24px_rgba(0,0,0,0.5)] backdrop-blur-2xl md:right-auto md:w-[min(20rem,calc(100vw-2rem))]">
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

            <div
              ref={toolbarFilterRef}
              className="scrollbar-hide w-full min-w-0 overflow-x-auto overscroll-x-contain pb-1 touch-pan-x md:w-auto md:flex-[0_1_auto] md:pb-0"
            >
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
                className="mb-0 w-max flex-nowrap gap-2 [&_.filter-chip]:h-10 [&_.filter-chip]:gap-1.5 [&_.filter-chip]:border-border [&_.filter-chip]:bg-foreground/[0.065] [&_.filter-chip]:px-3.5 [&_.filter-chip]:text-xs [&_.filter-chip]:text-muted-foreground [&_.filter-chip:hover]:text-foreground [&_.filter-chip[data-active=true]]:border-primary/50 [&_.filter-chip[data-active=true]]:bg-primary/15 [&_.filter-chip[data-active=true]]:text-primary [&_.filter-control-group]:gap-1.5 [&_.filter-segment]:whitespace-nowrap [&_.filter-segment]:px-3 [&_.filter-segment]:text-xs [&_.filter-segment:first-child]:px-4 [&_.filter-segmented]:h-10 [&_.filter-segmented]:border-border [&_.filter-segmented]:bg-foreground/[0.055] [&_[data-filter-clear]]:w-auto [&_[data-filter-clear]]:justify-start [&_[data-filter-clear]]:px-3.5 md:max-2xl:[&_[data-filter-clear]]:w-10 md:max-2xl:[&_[data-filter-clear]]:justify-center md:max-2xl:[&_[data-filter-clear]]:px-0 md:max-2xl:[&_[data-filter-clear-label]]:hidden"
              />
            </div>
          </div>
        }
        actions={
          <>
            <ViewSwitcher mode={mode} disabled={isSwitching} onSelect={selectMode} />
            <ThemeToggle className="h-10 w-10 shrink-0 border border-border bg-foreground/[0.055] text-muted-foreground hover:bg-foreground/[0.09] hover:text-foreground md:hidden lg:inline-flex" />
            <OwnerMenu
              avatarUrl={avatarUrl}
              displayName={displayName}
            />
          </>
        }
      />

      {mode === "shelf" ? (
        <motion.main
          initial={false}
          animate={{ opacity: isSwitching ? 0.16 : 1, y: isSwitching ? 2 : 0 }}
          transition={{
            duration: reducedMotion ? 0 : 0.2,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="w-full flex-1 px-3 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-6 md:px-5 lg:px-8 xl:px-10"
        >
          {titles.length ? (
            visibleShelfTitles.length ? (
              <MediaGrid
                titles={visibleShelfTitles}
                reorderContext={reorderContext}
                preserveGridAcrossReorderModes
                compactMobile
                presentation="profile"
                showCardActions={false}
                animateEntrance={false}
                activeTitleId={shelfTitle?.id ?? null}
                onTitleSelect={openShelfTitle}
              />
            ) : (
              <EmptyState
                icon={<Film className="h-6 w-6" />}
                title="No titles match"
                description="Try another filter or search."
              />
            )
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
            centerAfterId="library-collection-controls"
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
