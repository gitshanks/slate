"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Box, Film, LayoutGrid, Search, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { FilteredGrid } from "@/components/filtered-grid";
import { cn } from "@/lib/utils";
import type { TitleRow, TitleStatus } from "@/lib/types";

const SpatialPosterGrid = dynamic(
  () =>
    import("@/components/spatial-poster-grid").then(
      (module) => module.SpatialPosterGrid,
    ),
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
  const [query, setQuery] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchTarget, setSearchTarget] = React.useState<{
    titleId: string;
    request: number;
  } | null>(null);
  const searchRequestRef = React.useRef(0);
  const reducedMotion = useReducedMotion();
  const router = useRouter();
  const exitSpatial = React.useCallback(() => setMode("grid"), []);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const searchableTitles = mode === "spatial" ? spatialTitles : titles;
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

  const selectMode = React.useCallback(
    (nextMode: ViewMode) => {
      if (nextMode === mode) return;
      setMode(nextMode);
      if (nextMode === "grid") setSearchTarget(null);
      setSearchOpen(nextMode === "spatial" && normalizedQuery.length > 0);
    },
    [mode, normalizedQuery.length],
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
        className="dark fixed inset-x-3 z-[70] mx-auto max-w-[1540px] rounded-[1.35rem] border border-white/12 bg-black/72 p-2 text-white shadow-[0_22px_70px_-28px_rgba(0,0,0,0.9)] backdrop-blur-2xl sm:inset-x-5 sm:rounded-full"
        style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
        aria-label={`${displayName}'s slate controls`}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[minmax(10rem,1fr)_minmax(14rem,28rem)_minmax(15rem,1fr)]">
          <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2.5 pl-1 sm:pl-0.5">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="h-9 w-9 shrink-0 rounded-full border border-white/15 object-cover"
              />
            ) : (
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[0.07] text-xs font-semibold text-white/72">
                {displayName.slice(0, 1).toLocaleUpperCase()}
              </span>
            )}
            <div className="min-w-0 leading-none">
              <p className="truncate text-sm font-semibold tracking-[-0.02em] text-white">
                {displayName}&rsquo;s slate
              </p>
              <p className="mt-1 truncate font-mono text-[9px] tracking-[0.08em] text-white/40">
                @{username}
              </p>
            </div>
          </div>

          <div
            className="relative col-start-1 row-start-2 min-w-0 sm:col-start-2 sm:row-start-1"
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
              className="h-10 w-full rounded-full border border-white/12 bg-white/[0.065] pl-10 pr-10 text-sm text-white outline-none transition-[border-color,background-color] duration-150 placeholder:text-white/38 focus:border-primary/55 focus:bg-white/[0.085]"
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

          <div className="col-start-2 row-start-2 flex items-center justify-end gap-2 sm:col-start-3 sm:row-start-1">
            <div
              className="relative grid h-9 grid-cols-2 rounded-full border border-white/12 bg-white/[0.055] p-0.5"
              role="group"
              aria-label="Collection view"
            >
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute bottom-0.5 left-0.5 top-0.5 w-[calc(50%-0.125rem)] rounded-full transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
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
                  "relative z-10 inline-flex min-w-[3.75rem] items-center justify-center gap-1 rounded-full px-2 text-[10px] font-medium transition-colors duration-150 active:scale-[0.97]",
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
                  "relative z-10 inline-flex min-w-[3.75rem] items-center justify-center gap-1 rounded-full px-2 text-[10px] font-medium transition-colors duration-150 active:scale-[0.97]",
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
              className="hidden h-9 items-center rounded-full bg-primary px-3.5 text-xs font-semibold text-primary-foreground transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.97] sm:inline-flex"
            >
              Make your own
            </button>
          </div>

          <button
            type="button"
            onClick={() => router.push("/login")}
            className="col-start-2 row-start-1 inline-flex h-9 items-center rounded-full bg-primary px-3 text-[11px] font-semibold text-primary-foreground transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.97] sm:hidden"
          >
            Make your own
          </button>
        </div>
      </header>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
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
        {titles.length ? (
          <>
            <FilterBar
              genres={genres}
              showSentiment={status === "watched"}
              recentSortLabel={status === "watched" ? "Recently watched" : undefined}
            />
            <React.Suspense fallback={null}>
              <FilteredGrid
                allTitles={titles}
                status={status}
                readOnly
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

      <AnimatePresence initial={false}>
        {mode === "spatial" ? (
          <motion.div
            key="spatial"
            role="dialog"
            aria-modal="true"
            aria-label="Space view"
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.24 }}
            className="fixed inset-0 z-40 bg-[#080a09]"
          >
            <SpatialPosterGrid
              titles={spatialTitles}
              username={username}
              onExit={exitSpatial}
              searchTarget={searchTarget}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
