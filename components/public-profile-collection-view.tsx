"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  Box,
  Film,
  LayoutGrid,
  Search,
  X,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { MediaGrid } from "@/components/media-grid";
import type { SpatialCameraState } from "@/components/spatial-poster-grid";
import { extractGenres, filterAndSort } from "@/lib/filter-utils";
import { loadPublicTitleDetail } from "@/lib/public-title-detail-cache";
import { cn } from "@/lib/utils";
import type { TitleRow } from "@/lib/types";

const loadSpatialPosterGrid = () => import("@/components/spatial-poster-grid");
const loadPublicTitleDetailOverlay = () => import("@/components/spatial-poster-grid");

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

const PublicTitleDetailOverlay = dynamic(
  () =>
    loadPublicTitleDetailOverlay().then(
      (module) => module.PublicTitleDetailOverlay,
    ),
  { ssr: false },
);

type ViewMode = "shelf" | "space";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "want", label: "Up Next" },
  { value: "watching", label: "Watching" },
  { value: "watched", label: "Watched" },
] as const;

interface PublicProfileCollectionViewProps {
  titles: TitleRow[];
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export function PublicProfileCollectionView({
  titles,
  username,
  displayName,
  avatarUrl,
}: PublicProfileCollectionViewProps) {
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
  const [isSwitching, setIsSwitching] = React.useState(false);
  const [shelfTitle, setShelfTitle] = React.useState<TitleRow | null>(null);
  const searchRequestRef = React.useRef(0);
  const viewSwitchTimerRef = React.useRef<number | null>(null);
  const reducedMotion = useReducedMotion();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = React.useState<ViewMode>(() =>
    searchParams.get("view") === "shelf" ? "shelf" : "space",
  );
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const status = searchParams.get("spaceStatus");
  const filterParams = React.useMemo(
    () => ({
      type: searchParams.get("type") ?? undefined,
      genre: searchParams.get("genre") ?? undefined,
      year: searchParams.get("year") ?? undefined,
      sentiment:
        status === "watched"
          ? (searchParams.get("sentiment") ?? undefined)
          : undefined,
    }),
    [searchParams, status],
  );
  const filteredTitles = React.useMemo(() => {
    const scopedTitles =
      status === "want" || status === "watching" || status === "watched"
        ? titles.filter((title) => title.status === status)
        : titles;
    return filterAndSort(
      scopedTitles,
      status === "want" || status === "watching" || status === "watched"
        ? status
        : "all",
      filterParams,
    );
  }, [filterParams, status, titles]);
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
  const matches = React.useMemo(() => {
    if (!normalizedQuery) return [];
    return filteredTitles
      .filter((title) =>
        `${title.title} ${title.original_title ?? ""}`
          .toLocaleLowerCase()
          .includes(normalizedQuery),
      )
      .slice(0, 5);
  }, [filteredTitles, normalizedQuery]);

  const focusTitle = React.useCallback((titleId: string) => {
    searchRequestRef.current += 1;
    setSearchTarget({ titleId, request: searchRequestRef.current });
  }, []);

  const closeShelfTitle = React.useCallback(() => {
    setShelfTitle(null);
  }, []);

  const openShelfTitle = React.useCallback(
    (title: TitleRow) => {
      // Begin the request at press time. The slab consumes this same in-flight
      // result as soon as it mounts, matching Space's immediate detail path.
      void loadPublicTitleDetail(username, title.id);
      const source = document.getElementById(`shelf-title-${title.id}`);
      if (!source) {
        setShelfTitle(title);
        return;
      }

      const sourceRect = source.getBoundingClientRect();
      const narrow = window.matchMedia("(max-width: 639px)").matches;
      // Desktop slabs sit level with their source; compact screens reserve
      // room directly beneath the card rather than covering it.
      const targetCenter = window.innerHeight * (narrow ? 0.28 : 0.5);
      const delta =
        sourceRect.top + sourceRect.height / 2 - targetCenter;

      if (Math.abs(delta) > 2) {
        window.scrollBy({
          top: delta,
          // Settle the source first so the adjacent slab can open in the same
          // interaction, rather than waiting behind a timed scroll animation.
          behavior: "auto",
        });
      }
      setShelfTitle(title);
    },
    [username],
  );

  const selectMode = React.useCallback(
    (nextMode: ViewMode) => {
      if (nextMode === mode || isSwitching) return;
      setIsSwitching(true);
      setSearchOpen(false);
      const params = new URLSearchParams(window.location.search);
      if (nextMode === "shelf") params.set("view", "shelf");
      else params.delete("view");
      const queryString = params.toString();
      window.history.replaceState(
        null,
        "",
        queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname,
      );
      viewSwitchTimerRef.current = window.setTimeout(
        () => {
          setMode(nextMode);
          if (nextMode === "shelf") setSearchTarget(null);
          viewSwitchTimerRef.current = null;
        },
        reducedMotion ? 0 : 110,
      );
    },
    [isSwitching, mode, reducedMotion],
  );

  const selectSearchResult = React.useCallback(
    (title: TitleRow) => {
      setSearchOpen(false);
      if (mode === "space") {
        focusTitle(title.id);
        return;
      }
      openShelfTitle(title);
    },
    [focusTitle, mode, openShelfTitle],
  );

  React.useEffect(() => {
    // Shelf opens its title slab on the first press as well, so warm that
    // lightweight client boundary while the profile is being read.
    void loadPublicTitleDetailOverlay();
    const timer = window.setTimeout(() => {
      void loadSpatialPosterGrid();
    }, 600);
    return () => window.clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    if (!isSwitching) return;
    const frame = window.requestAnimationFrame(() => {
      if (viewSwitchTimerRef.current === null) setIsSwitching(false);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isSwitching, mode]);

  React.useEffect(
    () => () => {
      if (viewSwitchTimerRef.current !== null) {
        window.clearTimeout(viewSwitchTimerRef.current);
      }
    },
    [],
  );

  React.useEffect(() => {
    if (mode !== "space") return;

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
    <div className="dark min-h-dvh bg-[#080a09] text-white">
      <header
        className="pointer-events-none fixed inset-x-0 top-0 z-[70] px-2.5 pb-8 text-white min-[380px]:px-3 md:px-2 md:pb-7 lg:px-5 xl:px-6"
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

        <div className="pointer-events-auto grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-x-0.5 lg:gap-x-2.5 xl:gap-x-5">
          <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2 pl-0.5 md:gap-1.5 lg:gap-2.5 xl:justify-self-start">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="h-7 w-7 shrink-0 rounded-full border border-white/15 object-cover min-[380px]:h-8 min-[380px]:w-8 lg:h-9 lg:w-9"
              />
            ) : (
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[0.07] text-[10px] font-semibold text-white/72 min-[380px]:h-8 min-[380px]:w-8 min-[380px]:text-[11px] lg:h-9 lg:w-9 lg:text-xs">
                {displayName.slice(0, 1).toLocaleUpperCase()}
              </span>
            )}
            <div className="min-w-0 leading-none md:max-lg:hidden">
              <p className="truncate text-xs font-semibold tracking-[-0.02em] text-white min-[380px]:text-[13px] lg:text-sm">
                {displayName}&rsquo;s slate
              </p>
              <p className="mt-1 hidden truncate font-mono text-[9px] tracking-[0.08em] text-white/40 min-[380px]:block">
                @{username}
              </p>
            </div>
          </div>

          <div className="col-start-2 row-start-1 flex shrink-0 items-center justify-end gap-1 md:col-start-3 md:gap-1 lg:gap-2 xl:justify-self-end">
            <div
              className="relative grid h-10 w-[5.25rem] shrink-0 grid-cols-2 rounded-full border border-white/12 bg-white/[0.055] p-0.5"
              role="group"
              aria-label="Collection view"
            >
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute bottom-0.5 left-0.5 top-0.5 w-[calc(50%-0.125rem)] rounded-full shadow-[0_1px_8px_rgba(0,0,0,0.18)] transition-[transform,background-color] duration-[240ms] ease-[cubic-bezier(0.65,0,0.35,1)]",
                  mode === "shelf"
                    ? "translate-x-0 bg-white"
                    : "translate-x-full bg-primary",
                )}
              />
              <button
                type="button"
                onClick={() => selectMode("shelf")}
                aria-pressed={mode === "shelf"}
                aria-label="Shelf view"
                disabled={isSwitching}
                className={cn(
                  "relative z-10 inline-flex w-10 items-center justify-center rounded-full transition-[color,transform] duration-200 ease-[cubic-bezier(0.65,0,0.35,1)] outline-none active:scale-[0.97] focus-visible:ring-1 focus-visible:ring-primary/60 disabled:pointer-events-none",
                  mode === "shelf" ? "text-black" : "text-white/52 hover:text-white",
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => selectMode("space")}
                aria-pressed={mode === "space"}
                aria-label="Space view"
                disabled={isSwitching}
                className={cn(
                  "relative z-10 inline-flex w-10 items-center justify-center rounded-full transition-[color,transform] duration-200 ease-[cubic-bezier(0.65,0,0.35,1)] outline-none active:scale-[0.97] focus-visible:ring-1 focus-visible:ring-primary/60 disabled:pointer-events-none",
                  mode === "space"
                    ? "text-primary-foreground"
                    : "text-white/52 hover:text-white",
                )}
              >
                <Box className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => router.push("/login")}
              aria-label="Get slate"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary transition-[border-color,background-color,transform] duration-150 hover:border-primary/40 hover:bg-primary/15 active:scale-[0.97] lg:w-auto lg:border-0 lg:bg-primary lg:px-3.5 lg:text-xs lg:text-primary-foreground lg:hover:bg-primary/90"
            >
              <ArrowUpRight className="h-3.5 w-3.5 lg:mr-1.5" />
              <span className="hidden lg:inline">Get slate</span>
            </button>
          </div>

          <div className="col-span-2 col-start-1 row-start-2 flex min-w-0 flex-wrap items-center gap-2 md:col-span-1 md:col-start-2 md:row-start-1 md:w-full md:flex-nowrap md:justify-center md:gap-0.5">
            <div
              className="relative w-full min-w-0 md:w-[clamp(4rem,9vw,6.5rem)] md:shrink-0 lg:w-[clamp(9rem,15vw,15rem)]"
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
                onKeyDown={(event) => {
                  if (
                    event.key !== "Enter" ||
                    event.nativeEvent.isComposing ||
                    !matches[0]
                  ) {
                    return;
                  }
                  event.preventDefault();
                  selectSearchResult(matches[0]);
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
                <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-10 overflow-hidden rounded-2xl border border-white/12 bg-[#080908]/95 p-1.5 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.95)] backdrop-blur-2xl">
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
                          {title.status === "want" ? "Up Next" : title.status}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-2.5 text-xs text-white/42">
                      No title found
                    </p>
                  )}
                </div>
              ) : null}
            </div>

            <div className="scrollbar-hide w-full overflow-x-auto overscroll-x-contain pb-1 touch-pan-x md:w-max md:flex-none md:overflow-visible md:pb-0">
              <FilterBar
                genres={genres}
                showSort={false}
                typeDisplay="menu"
                showSentiment={status === "watched"}
                sentimentDisplay="menu"
                statusOptions={STATUS_OPTIONS}
                statusParam="spaceStatus"
                fullHeightStatus
                idPrefix="shared"
                popoverClassName="z-[80]"
                groupControls
                className="mb-0 w-max flex-nowrap gap-2 md:gap-1 [&_.filter-chip]:h-10 [&_.filter-chip]:border-white/12 [&_.filter-chip]:bg-white/[0.065] [&_.filter-chip]:text-white/60 [&_.filter-chip:hover]:text-white [&_.filter-chip[data-active=true]]:border-primary/45 [&_.filter-chip[data-active=true]]:bg-primary/15 [&_.filter-chip[data-active=true]]:text-primary [&_.filter-segment]:whitespace-nowrap [&_.filter-segment]:px-2.5 [&_.filter-segment:first-child]:px-3.5 [&_.filter-segmented]:h-10 [&_[data-filter-clear]]:px-3 md:[&_.filter-chip]:gap-1 md:[&_.filter-chip]:px-2 md:[&_.filter-segment]:px-1.5 md:[&_[data-filter-clear]]:w-10 md:[&_[data-filter-clear]]:justify-center md:[&_[data-filter-clear-label]]:hidden md:max-lg:[&_.filter-chip]:px-1.5 md:max-lg:[&_.filter-chip]:text-[10px] md:max-lg:[&_.filter-chip_.lucide-chevron-down]:hidden md:max-lg:[&_.filter-control-group]:gap-0.5 md:max-lg:[&_.filter-segment]:px-1 md:max-lg:[&_.filter-segment]:text-[10px] md:max-lg:[&_[data-filter-sentiment]]:w-10 md:max-lg:[&_[data-filter-sentiment]]:justify-center md:max-lg:[&_[data-filter-sentiment]]:px-0 md:max-lg:[&_[data-filter-sentiment-label]]:hidden lg:[&_[data-filter-clear-label]]:inline lg:[&_.filter-segment]:px-2.5"
              />
            </div>
          </div>
        </div>
      </header>

      {mode === "shelf" ? (
        <>
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: isSwitching ? 0.16 : 1, y: isSwitching ? 2 : 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="min-h-dvh bg-[#080a09] px-3 pb-12 pt-48 sm:px-6 sm:pt-32"
          >
            <div className="w-full">
              {visibleShelfTitles.length ? (
                <MediaGrid
                  titles={visibleShelfTitles}
                  readOnly
                  compactMobile
                  titleHrefBase={`/u/${username}/title`}
                  titleHrefSearch="?view=shelf"
                  activeTitleId={shelfTitle?.id}
                  presentation="profile"
                  onTitleSelect={openShelfTitle}
                />
              ) : (
                <EmptyState
                  icon={<Film className="h-6 w-6" />}
                  title={
                    titles.length
                      ? "No titles match these filters"
                      : "Nothing here yet"
                  }
                  description={
                    titles.length
                      ? "Try a different filter or search."
                      : "This slate is waiting for its first title."
                  }
                />
              )}
            </div>
          </motion.div>
          {shelfTitle ? (
            <PublicTitleDetailOverlay
              title={shelfTitle}
              username={username}
              anchorTitleId={shelfTitle.id}
              onClose={closeShelfTitle}
            />
          ) : null}
        </>
      ) : (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Space view"
          initial={reducedMotion ? false : { opacity: 0, scale: 1.008 }}
          animate={{ opacity: isSwitching ? 0.16 : 1, scale: isSwitching ? 1.002 : 1 }}
          transition={{ duration: reducedMotion ? 0 : 0.22, ease: [0.65, 0, 0.35, 1] }}
          className="fixed inset-0 z-40 bg-[#080a09] will-change-[opacity,transform]"
        >
          <SpatialPosterGrid
            titles={filteredTitles}
            username={username}
            onExit={() => selectMode("shelf")}
            searchTarget={searchTarget}
            initialCamera={spatialCamera}
            onCameraChange={setSpatialCamera}
          />
        </motion.div>
      )}
    </div>
  );
}
