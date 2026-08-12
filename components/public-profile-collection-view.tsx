"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, Check, Clock, Eye, Film, LayoutGrid, Search, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { FilteredGrid } from "@/components/filtered-grid";
import { SegmentedFilter } from "@/components/segmented-filter";
import { extractGenres, filterAndSort } from "@/lib/filter-utils";
import { cn } from "@/lib/utils";
import type { TitleRow, TitleStatus } from "@/lib/types";
import type { SpatialCameraState } from "@/components/spatial-poster-grid";

const loadSpatialPosterGrid = () => import("@/components/spatial-poster-grid");

const SpatialPosterGrid = dynamic(
  () => loadSpatialPosterGrid().then((module) => module.SpatialPosterGrid),
  {
    ssr: false,
    loading: () => (
      <div className="relative grid h-full w-full place-items-center overflow-hidden bg-[#080a09]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(173,235,179,0.08),transparent_46%)]" />
        <div className="relative flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          Opening the gallery
        </div>
      </div>
    ),
  },
);

type ViewMode = "grid" | "spatial";

const SPACE_STATUS_OPTIONS = [
  { value: "", label: "All", icon: LayoutGrid },
  { value: "want", label: "Watchlist", icon: Clock },
  { value: "watching", label: "Watching", icon: Eye },
  { value: "watched", label: "Watched", icon: Check },
] as const;

const SHELF_STATUS_OPTIONS = [
  { value: "want", label: "Watchlist", icon: Clock },
  { value: "watching", label: "Watching", icon: Eye },
  { value: "watched", label: "Watched", icon: Check },
] as const;

interface PublicProfileCollectionViewProps {
  eyebrow: string;
  label: string;
  titles: TitleRow[];
  spatialTitles: TitleRow[];
  genres: { id: number; name: string }[];
  status: Exclude<TitleStatus, "dropped">;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export function PublicProfileCollectionView({
  eyebrow,
  label,
  titles,
  spatialTitles,
  genres,
  status,
  username,
  displayName,
  avatarUrl,
}: PublicProfileCollectionViewProps) {
  const [mode, setMode] = React.useState<ViewMode>("grid");
  const [spatialMounted, setSpatialMounted] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchTarget, setSearchTarget] = React.useState<{
    titleId: string;
    request: number;
  } | null>(null);
  const searchRequestRef = React.useRef(0);
  const [spatialCamera, setSpatialCamera] = React.useState<SpatialCameraState>({
    x: 0,
    y: 0,
    scale: 0.88,
  });
  const reducedMotion = useReducedMotion();
  const router = useRouter();
  const searchParams = useSearchParams();
  const exitSpatial = React.useCallback(() => setMode("grid"), []);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filterParams = React.useMemo(
    () => ({
      type: searchParams.get("type") ?? undefined,
      genre: searchParams.get("genre") ?? undefined,
      year: searchParams.get("year") ?? undefined,
      sort: searchParams.get("sort") ?? undefined,
      sentiment: searchParams.get("sentiment") ?? undefined,
    }),
    [searchParams],
  );
  const spatialStatus = searchParams.get("spaceStatus");
  const filteredSpatialTitles = React.useMemo(() => {
    const scopedTitles =
      spatialStatus === "want" ||
      spatialStatus === "watching" ||
      spatialStatus === "watched"
        ? spatialTitles.filter((title) => title.status === spatialStatus)
        : spatialTitles;
    return filterAndSort(
      scopedTitles,
      spatialStatus === "want" ||
        spatialStatus === "watching" ||
        spatialStatus === "watched"
        ? spatialStatus
        : "all",
      { ...filterParams, sort: undefined },
    );
  }, [filterParams, spatialStatus, spatialTitles]);
  const filteredShelfTitles = React.useMemo(
    () => filterAndSort(titles, status, filterParams),
    [filterParams, status, titles],
  );
  const spatialGenres = React.useMemo(
    () => extractGenres(spatialTitles),
    [spatialTitles],
  );
  const searchableTitles =
    mode === "spatial" ? filteredSpatialTitles : filteredShelfTitles;
  const matches = React.useMemo(() => {
    if (!normalizedQuery) return [];
    return searchableTitles
      .filter((title) =>
        `${title.title} ${title.original_title ?? ""}`
          .toLocaleLowerCase()
          .includes(normalizedQuery),
      )
      .slice(0, 5);
  }, [normalizedQuery, searchableTitles]);

  const focusSpatialTitle = React.useCallback((titleId: string) => {
    searchRequestRef.current += 1;
    setSearchTarget({ titleId, request: searchRequestRef.current });
  }, []);

  const selectShelfStatus = React.useCallback(
    (nextStatus: string) => {
      if (nextStatus === status) return;
      const nextTab =
        nextStatus === "watching"
          ? "watching"
          : nextStatus === "watched"
            ? "watched"
            : null;
      router.push(
        nextTab
          ? `/u/${username}?tab=${nextTab}`
          : `/u/${username}`,
        { scroll: false },
      );
    },
    [router, status, username],
  );

  const selectMode = React.useCallback(
    (nextMode: ViewMode) => {
      if (nextMode === mode) return;
      if (nextMode === "spatial") setSpatialMounted(true);
      setMode(nextMode);
      if (nextMode === "grid") setSearchTarget(null);
      setSearchOpen(nextMode === "spatial" && normalizedQuery.length > 0);
    },
    [mode, normalizedQuery.length],
  );

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSpatialPosterGrid();
    }, 600);
    return () => window.clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    if (mode !== "grid" || !spatialMounted) return;
    const timer = window.setTimeout(() => setSpatialMounted(false), 220);
    return () => window.clearTimeout(timer);
  }, [mode, spatialMounted]);

  const persistSpatialCamera = React.useCallback(
    (camera: SpatialCameraState) => {
      setSpatialCamera(camera);
    },
    [],
  );

  const selectSearchResult = React.useCallback(
    (title: TitleRow) => {
      setSearchOpen(false);
      if (mode === "spatial") {
        focusSpatialTitle(title.id);
        return;
      }
      router.push(`/u/${username}/title/${title.id}`);
    },
    [focusSpatialTitle, mode, router, username],
  );

  React.useEffect(() => {
    if (
      mode !== "spatial" ||
      !searchOpen ||
      normalizedQuery.length < 2 ||
      matches.length === 0
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSearchOpen(false);
      focusSpatialTitle(matches[0].id);
    }, 320);
    return () => window.clearTimeout(timer);
  }, [focusSpatialTitle, matches, mode, normalizedQuery, searchOpen]);

  React.useEffect(() => {
    if (mode !== "spatial") return;

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [mode]);

  return (
    <div>
      <header
        className="dark pointer-events-none fixed inset-x-0 top-0 z-[70] px-3 pb-8 text-white sm:px-6 sm:pb-7"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        aria-label={`${displayName}'s slate controls`}
      >
        <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(8,10,9,0.98)_0%,rgba(8,10,9,0.9)_54%,rgba(8,10,9,0.54)_76%,rgba(8,10,9,0)_100%)]" />
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

        <div className="pointer-events-auto mx-auto grid w-full max-w-[1540px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 sm:grid-cols-[minmax(10rem,1fr)_minmax(14rem,28rem)_minmax(15rem,1fr)]">
          <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2.5 pl-1 sm:pl-0.5">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="h-8 w-8 shrink-0 rounded-full border border-white/15 object-cover sm:h-9 sm:w-9"
              />
            ) : (
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[0.07] text-[11px] font-semibold text-white/72 sm:h-9 sm:w-9 sm:text-xs">
                {displayName.slice(0, 1).toLocaleUpperCase()}
              </span>
            )}
            <div className="min-w-0 leading-none">
              <p className="truncate text-[13px] font-semibold tracking-[-0.02em] text-white sm:text-sm">
                {displayName}&rsquo;s slate
              </p>
              <p className="mt-1 truncate font-mono text-[9px] tracking-[0.08em] text-white/40">
                @{username}
              </p>
            </div>
          </div>

          <div
            className="relative col-span-2 col-start-1 row-start-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-1"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setSearchOpen(false);
              }
            }}
          >
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/42" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => {
                if (normalizedQuery) setSearchOpen(true);
              }}
              placeholder="Find a title"
              aria-label={`Find a title in ${displayName}'s slate`}
              className="h-10 w-full rounded-2xl border border-white/12 bg-white/[0.065] pl-10 pr-10 text-sm text-white outline-none transition-[border-color,background-color] duration-150 placeholder:text-white/38 focus:border-primary/45 focus:bg-white/[0.09] sm:rounded-full sm:focus:border-primary/55"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setSearchOpen(false);
                  setSearchTarget(null);
                }}
                className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-white/42 transition-[color,background-color,transform] duration-150 hover:bg-white/10 hover:text-white active:scale-[0.96]"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}

            {normalizedQuery && searchOpen ? (
              <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] overflow-hidden rounded-2xl border border-white/12 bg-[#080908]/95 p-1.5 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.95)] backdrop-blur-2xl">
                {matches.length ? (
                  matches.map((title) => (
                    <button
                      key={title.id}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectSearchResult(title)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-xs text-white/78 transition-[color,background-color,transform] duration-150 hover:bg-white/8 hover:text-white active:scale-[0.99]"
                    >
                      <span className="truncate">{title.title}</span>
                      <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.08em] text-white/34">
                        {title.status === "want" ? "Watchlist" : title.status}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2.5 text-xs text-white/42">No title found</p>
                )}
              </div>
            ) : null}
          </div>

          <div className="col-start-2 row-start-1 flex items-center justify-end gap-1.5 sm:col-start-3 sm:gap-2">
            <div
              className="relative grid h-8 grid-cols-2 rounded-full border border-white/12 bg-white/[0.055] p-0.5 sm:h-9"
              role="group"
              aria-label="Collection view"
            >
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute bottom-0.5 left-0.5 top-0.5 w-[calc(50%-0.125rem)] rounded-full shadow-[0_1px_8px_rgba(0,0,0,0.18)] transition-[transform,background-color] duration-[240ms] ease-[cubic-bezier(0.65,0,0.35,1)]",
                  mode === "grid"
                    ? "translate-x-0 bg-white text-black"
                    : "translate-x-full bg-primary text-primary-foreground",
                )}
              />
              <button
                type="button"
                onClick={() => selectMode("grid")}
                aria-pressed={mode === "grid"}
                className={cn(
                  "relative z-10 inline-flex min-w-[4rem] items-center justify-center gap-1.5 rounded-full px-3 text-[9px] font-medium transition-[color,transform] duration-200 ease-[cubic-bezier(0.65,0,0.35,1)] outline-none active:scale-[0.97] focus-visible:ring-1 focus-visible:ring-primary/60 sm:min-w-[4.5rem] sm:px-3.5 sm:text-[10px]",
                  mode === "grid" ? "text-black" : "text-white/52 hover:text-white",
                )}
              >
                <LayoutGrid className="h-3 w-3" />
                Shelf
              </button>
              <button
                type="button"
                onClick={() => selectMode("spatial")}
                aria-pressed={mode === "spatial"}
                className={cn(
                  "relative z-10 inline-flex min-w-[4rem] items-center justify-center gap-1.5 rounded-full px-3 text-[9px] font-medium transition-[color,transform] duration-200 ease-[cubic-bezier(0.65,0,0.35,1)] outline-none active:scale-[0.97] focus-visible:ring-1 focus-visible:ring-primary/60 sm:min-w-[4.5rem] sm:px-3.5 sm:text-[10px]",
                  mode === "spatial"
                    ? "text-primary-foreground"
                    : "text-white/52 hover:text-white",
                )}
              >
                <Box className="h-3 w-3" />
                Space
              </button>
            </div>
            <button
              type="button"
              onClick={() => router.push("/login")}
              aria-label="Make your own"
              className="inline-flex h-8 items-center rounded-full border border-primary/25 bg-primary/10 px-2.5 text-[10px] font-semibold text-primary transition-[border-color,background-color,transform] duration-150 hover:border-primary/40 hover:bg-primary/15 active:scale-[0.97] sm:h-9 sm:border-0 sm:bg-primary sm:px-3.5 sm:text-xs sm:text-primary-foreground sm:hover:bg-primary/90"
            >
              <span aria-hidden className="hidden min-[360px]:inline">Make your own</span>
              <span aria-hidden className="min-[360px]:hidden">Create</span>
            </button>
          </div>
        </div>

        {mode === "spatial" ? (
          <div className="pointer-events-auto mx-auto mt-2 w-full max-w-[1540px] overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mt-2.5 sm:overflow-visible">
            <FilterBar
              genres={spatialGenres}
              showSort={false}
              typeDisplay="menu"
              showSentiment
              sentimentDisplay="menu"
              statusOptions={SPACE_STATUS_OPTIONS}
              statusParam="spaceStatus"
              idPrefix="space"
              popoverClassName="z-[80]"
              groupControls
              className="mx-auto mb-0 w-max flex-nowrap justify-center gap-1.5 [&_.filter-chip]:border-white/12 [&_.filter-chip]:bg-white/[0.065] [&_.filter-chip]:text-white/60 [&_.filter-chip:hover]:text-white [&_.filter-segment]:whitespace-nowrap [&_.filter-segment]:px-2.5"
            />
          </div>
        ) : null}
      </header>

      <div className="mb-6 hidden flex-wrap items-end justify-between gap-4 sm:flex">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">
            {label}
          </h2>
        </div>
      </div>

      <div
        aria-hidden={mode === "spatial" || undefined}
        inert={mode === "spatial" ? true : undefined}
      >
        <div className="-mx-4 mb-7 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:mb-8 sm:overflow-visible sm:px-0 sm:pb-0">
          <div className="flex w-max items-center gap-1.5 sm:block sm:w-auto">
            <SegmentedFilter
              id="shelf-status-filter"
              options={SHELF_STATUS_OPTIONS}
              value={status}
              onValueChange={selectShelfStatus}
              className="shrink-0 border-white/12 bg-white/[0.065] sm:hidden"
            />
            {titles.length ? (
              <FilterBar
                genres={genres}
                showSentiment={status === "watched"}
                recentSortLabel={status === "watched" ? "Recently watched" : undefined}
                idPrefix="shelf"
                className="mb-0 w-max flex-nowrap gap-1.5 [&_.filter-chip]:border-white/12 [&_.filter-chip]:bg-white/[0.065] [&_.filter-chip]:text-white/60 [&_.filter-chip:hover]:text-white [&_.filter-segment]:whitespace-nowrap sm:w-auto sm:flex-wrap sm:gap-2"
              />
            ) : null}
          </div>
        </div>

        {titles.length ? (
          <>
            <React.Suspense fallback={null}>
              <FilteredGrid
                allTitles={titles}
                status={status}
                readOnly
                compactMobile
                titleHrefBase={`/u/${username}/title`}
                searchQuery={query}
              />
            </React.Suspense>
          </>
        ) : (
          <EmptyState
            icon={<Film className="h-6 w-6" />}
            title={`Nothing in ${label.toLowerCase()} yet`}
            description="This shelf is waiting for its first title."
          />
        )}
      </div>

      {spatialMounted ? (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Space view"
          aria-hidden={mode !== "spatial" || undefined}
          inert={mode !== "spatial" ? true : undefined}
          initial={
            reducedMotion
              ? false
              : { opacity: 0, transform: "scale(1.008)" }
          }
          animate={{
            opacity: mode === "spatial" ? 1 : 0,
            transform:
              reducedMotion || mode === "spatial"
                ? "scale(1)"
                : "scale(1.008)",
          }}
          transition={{
            duration: reducedMotion ? 0.12 : mode === "spatial" ? 0.26 : 0.2,
            ease: [0.65, 0, 0.35, 1],
          }}
          className={cn(
            "fixed inset-0 z-40 bg-[#080a09] will-change-[opacity,transform]",
            mode === "spatial" ? "pointer-events-auto" : "pointer-events-none",
          )}
        >
          <SpatialPosterGrid
            titles={filteredSpatialTitles}
            username={username}
            onExit={exitSpatial}
            searchTarget={searchTarget}
            initialCamera={spatialCamera}
            onCameraChange={persistSpatialCamera}
          />
        </motion.div>
      ) : null}
    </div>
  );
}
