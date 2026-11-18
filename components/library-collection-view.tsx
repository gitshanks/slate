"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import {
  Film,
  Plus,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import {
  LibraryNudges,
  SmallLibraryActions,
  type ListSuggestionNudge,
  type NewEpisodeNudge,
} from "@/components/library-nudges";
import { ViewSwitcher } from "@/components/view-switcher";
import { LibraryTitleActions } from "@/components/library-title-actions";
import { MediaGrid, type MediaGridReorderContext } from "@/components/media-grid";
import {
  OwnedAppToolbar,
  OwnerMenu,
} from "@/components/owned-app-toolbar";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProfileShareButton } from "@/components/profile-share-button";
import {
  useCommandPalette,
  useSmartSearchSession,
  type LibrarySelection,
} from "@/components/command-palette";
import { SmartSearchBar } from "@/components/smart-search-bar";
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
  { value: "all", label: "All" },
  { value: "want", label: "Up Next" },
  { value: "watching", label: "Watching" },
  { value: "watched", label: "Watched" },
] as const;

interface LibraryCollectionViewProps {
  titles: TitleRow[];
  displayName: string;
  avatarUrl: string | null;
  lists: { id: string; name: string }[];
  shareProfile?: { username: string; isPublic: boolean } | null;
  newEpisodes?: NewEpisodeNudge[];
  listSuggestion?: ListSuggestionNudge | null;
  canPickMore?: boolean;
  hiddenNudges?: string[];
}

export function LibraryCollectionView({
  titles,
  displayName,
  avatarUrl,
  lists,
  shareProfile,
  newEpisodes = [],
  listSuggestion = null,
  canPickMore = false,
  hiddenNudges = [],
}: LibraryCollectionViewProps) {
  const searchParams = useSearchParams();
  const { activate: activateSmartSearch } = useCommandPalette();
  const { query, setQuery } = useSmartSearchSession();
  const reducedMotion = useReducedMotion() ?? false;
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
  const status = searchParams.get("status") ?? "want";
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
  // A filter swaps the whole shelf at once, so the new set fades up the same
  // way a tab does instead of cutting in.
  const shelfRef = React.useRef<HTMLDivElement>(null);
  const shownFilterKey = React.useRef(filterTransitionKey);
  React.useLayoutEffect(() => {
    if (shownFilterKey.current === filterTransitionKey) return;
    shownFilterKey.current = filterTransitionKey;
    const shelf = shelfRef.current;
    if (!shelf || reducedMotion || typeof shelf.animate !== "function") return;
    // Part-way up, not from nothing: see `.app-tab-arrive` in globals.css.
    shelf.animate([{ opacity: 0.45 }, { opacity: 1 }], {
      duration: 220,
      easing: "cubic-bezier(0.33, 1, 0.68, 1)",
    });
  }, [filterTransitionKey, reducedMotion]);
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
      if (mode === "space") focusTitle(title.id);
      else openShelfTitle(title);
    },
    [focusTitle, mode, openShelfTitle],
  );

  const handleLibrarySearchSelect = React.useCallback(
    (selection: LibrarySelection) => {
      const selected = titles.find(
        (title) =>
          title.id === selection.id ||
          (title.tmdb_id === selection.tmdbId &&
            title.media_type === selection.mediaType),
      );
      if (!selected) return;

      // A cast/crew query usually does not contain the selected title's name.
      // Clear the local Shelf filter before opening so its poster is present
      // for anchoring (and visible when travelling through Space).
      setQuery("");
      selectSearchResult(selected);
    },
    [selectSearchResult, setQuery, titles],
  );

  const selectMode = React.useCallback(
    (nextMode: ViewMode) => {
      if (nextMode === mode || isSwitching) return;
      setIsSwitching(true);
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
        "relative isolate flex min-h-full w-full flex-col bg-background text-foreground md:min-h-dvh",
        mode === "space" && "h-full",
      )}
    >
      <OwnedAppToolbar
        id="library-collection-controls"
        ariaLabel="Your slate controls"
        center={
          <div className="col-span-2 col-start-1 row-start-2 flex min-w-0 flex-wrap items-center gap-2 md:contents min-[110rem]:col-span-1 min-[110rem]:col-start-2 min-[110rem]:row-start-1 min-[110rem]:flex min-[110rem]:w-full min-[110rem]:max-w-[80rem] min-[110rem]:flex-nowrap min-[110rem]:justify-center min-[110rem]:justify-self-center">
            <div
              ref={toolbarSearchRef}
              className="relative w-full min-w-0 shrink-0 md:col-start-2 md:row-start-1 md:w-auto md:justify-self-center"
            >
              <SmartSearchBar
                surfaceId="library-smart-search"
                onLibrarySelect={handleLibrarySearchSelect}
                ariaLabel="Search your slate, discover titles, or ask Slate"
              />
            </div>

            <div
              ref={toolbarFilterRef}
              className="scrollbar-hide w-full min-w-0 overflow-x-auto overscroll-x-contain pb-1 touch-pan-x md:col-span-3 md:col-start-1 md:row-start-2 md:pb-0 min-[110rem]:w-auto min-[110rem]:flex-[0_1_auto]"
            >
              <FilterBar
                genres={genres}
                showSort={mode === "shelf"}
                showSentiment={activeStatus === "watched"}
                statusOptions={STATUS_OPTIONS}
                statusParam="status"
                defaultStatus="want"
                idPrefix="owned-library"
                resultCount={mode === "shelf" ? visibleShelfTitles.length : undefined}
                className="mb-0 w-full min-[110rem]:w-max min-[110rem]:flex-nowrap"
              />
            </div>
          </div>
        }
        actions={
          <>
            <ViewSwitcher
              mode={mode}
              disabled={isSwitching}
              onSelect={selectMode}
              label="Library view"
            />
            <ThemeToggle className="h-10 w-10 shrink-0 border border-border bg-foreground/[0.055] text-muted-foreground hover:bg-foreground/[0.09] hover:text-foreground md:hidden lg:inline-flex" />
            {shareProfile?.isPublic ? (
              <ProfileShareButton username={shareProfile.username} displayName={displayName} avatarUrl={avatarUrl} titles={titles} />
            ) : null}
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
          {titles.length && !normalizedQuery ? (
            <LibraryNudges
              titleCount={titles.length}
              canPickMore={canPickMore}
              hiddenNudges={hiddenNudges}
              savedPosters={titles.slice(0, 5).map((title) => title.poster_path)}
              newEpisodes={newEpisodes}
              listSuggestion={listSuggestion}
              onOpenTitle={(titleId) => {
                const title = titles.find((item) => item.id === titleId);
                if (title) openShelfTitle(title);
              }}
            />
          ) : null}
          <div ref={shelfRef}>
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
                description="Add the first title you do not want to forget, pick from a few, or bring your history over."
                action={
                  <div className="flex w-[min(20rem,calc(100vw-3rem))] flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => activateSmartSearch()}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add a title
                    </button>
                    {/* Kept a grid at every width so both rows stay the same width. */}
                    <SmallLibraryActions canPickMore={canPickMore} secondary className="sm:grid [&>a]:sm:w-full" />
                  </div>
                }
              />
            </div>
          )}
          </div>
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
