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
      <div className="relative grid h-full w-full place-items-center overflow-hidden bg-[#080a09]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(173,235,179,0.08),transparent_46%)]" />
        <div className="relative flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
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
  username: string | null;
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
      className="relative grid h-10 w-[5.25rem] shrink-0 grid-cols-2 rounded-full border border-white/12 bg-white/[0.055] p-0.5"
      role="group"
      aria-label="Library view"
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
        onClick={() => onSelect("shelf")}
        aria-pressed={mode === "shelf"}
        aria-label="Shelf view"
        disabled={disabled}
        className={cn(
          "relative z-10 inline-flex w-10 items-center justify-center rounded-full outline-none transition-[color,transform] duration-200 ease-[cubic-bezier(0.65,0,0.35,1)] active:scale-[0.97] focus-visible:ring-1 focus-visible:ring-primary/60 disabled:pointer-events-none",
          mode === "shelf" ? "text-black" : "text-white/52 hover:text-white",
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
            : "text-white/52 hover:text-white",
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
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/12 bg-white/[0.055] text-white/62 transition-[border-color,background-color,color,transform] duration-150 hover:border-white/20 hover:bg-white/[0.09] hover:text-white active:scale-[0.97]"
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
            <span className="grid h-full w-full place-items-center text-xs font-semibold text-white/75 md:hidden">
              {displayName.slice(0, 1).toLocaleUpperCase()}
            </span>
          )}
          <Ellipsis className="hidden h-4 w-4 md:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="dark z-[90] w-48 border-white/12 bg-[#0c0e0d]/96 p-1.5 text-white shadow-[0_24px_70px_-24px_rgba(0,0,0,0.95)] backdrop-blur-2xl"
      >
        <DropdownMenuItem asChild className="gap-2 rounded-lg focus:bg-white/8">
          <Link href="/import">
            <Upload className="h-3.5 w-3.5 text-white/45" />
            Import
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem asChild className="gap-2 rounded-lg focus:bg-white/8">
          <Link href="/share">
            <Share2 className="h-3.5 w-3.5 text-white/45" />
            Share your profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="gap-2 rounded-lg focus:bg-white/8">
          <Link href="/profile">
            <Settings className="h-3.5 w-3.5 text-white/45" />
            Settings
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SmoothShelfResults({
  titles,
  selectedTitleId,
  onTitleSelect,
  reorderContext,
}: {
  titles: TitleRow[];
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
  const [phase, setPhase] =
    React.useState<ResultsTransitionPhase>("idle");
  const pendingTitles = React.useRef(titles);
  const incomingKey = titles.map((title) => title.id).join("|");
  const renderedKey = renderedTitles.map((title) => title.id).join("|");

  React.useEffect(() => {
    pendingTitles.current = titles;
  }, [titles]);

  React.useEffect(() => {
    if (reducedMotion) {
      setRenderedTitles(pendingTitles.current);
      setRenderedSignature(incomingSignature);
      setPhase("idle");
      return;
    }
    if (incomingSignature === renderedSignature) return;
    if (incomingKey === renderedKey) {
      setRenderedTitles(pendingTitles.current);
      setRenderedSignature(incomingSignature);
      return;
    }
    setPhase("fading-out");
  }, [
    incomingKey,
    incomingSignature,
    reducedMotion,
    renderedKey,
    renderedSignature,
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
  username,
  avatarUrl,
  lists,
}: LibraryCollectionViewProps) {
  const searchParams = useSearchParams();
  const { open: openCommandPalette } = useCommandPalette();
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
        "dark flex min-h-full w-full flex-col bg-[#080a09] text-white md:min-h-dvh",
        mode === "space" && "h-full",
      )}
    >
      <header
        id="library-collection-controls"
        className="pointer-events-none sticky inset-x-0 top-0 z-50 shrink-0 px-2.5 pb-7 text-white min-[380px]:px-3 md:px-2 md:pb-6 lg:px-5 xl:px-6"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        aria-label="Your slate controls"
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
          <Link
            href={APP_ROOT}
            aria-label="slate home"
            className="col-start-1 row-start-1 inline-flex items-center pl-0.5 outline-none transition-opacity hover:opacity-82 focus-visible:ring-1 focus-visible:ring-primary/60 md:hidden"
          >
            <Image
              src="/brand/logo-light.svg"
              alt="slate"
              width={62}
              height={17}
              loading="eager"
            />
          </Link>

          <Link
            href="/profile"
            className="col-start-1 row-start-1 hidden min-w-0 items-center gap-1.5 rounded-full pl-0.5 outline-none transition-opacity hover:opacity-82 focus-visible:ring-1 focus-visible:ring-primary/60 md:flex lg:gap-2.5 xl:justify-self-start"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="h-8 w-8 shrink-0 rounded-full border border-white/15 object-cover lg:h-9 lg:w-9"
              />
            ) : (
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[0.07] text-[11px] font-semibold text-white/72 lg:h-9 lg:w-9 lg:text-xs">
                {displayName.slice(0, 1).toLocaleUpperCase()}
              </span>
            )}
            <span className="min-w-0 leading-none md:max-lg:hidden">
              <span className="block truncate text-[13px] font-semibold tracking-[-0.02em] text-white lg:text-sm">
                {username ? <>{displayName}&rsquo;s slate</> : "Your slate"}
              </span>
              <span className="mt-1 block truncate font-mono text-[9px] tracking-[0.08em] text-white/40">
                {username ? `@${username}` : "Your library"}
              </span>
            </span>
          </Link>

          <div className="col-start-2 row-start-1 flex shrink-0 items-center justify-end gap-1 md:col-start-3 md:gap-1 lg:gap-2 xl:justify-self-end">
            <ViewSwitcher mode={mode} disabled={isSwitching} onSelect={selectMode} />
            <ThemeToggle className="h-10 w-10 shrink-0 border border-white/12 bg-white/[0.055] text-white/62 hover:bg-white/[0.09] hover:text-white md:hidden" />
            <OwnerMenu
              avatarUrl={avatarUrl}
              displayName={displayName}
            />
            <button
              type="button"
              onClick={openCommandPalette}
              aria-label="Find and add a title"
              className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.97] min-[900px]:inline-flex xl:w-auto xl:px-3.5 xl:text-xs xl:font-medium"
            >
              <Plus className="h-4 w-4 xl:mr-1.5" />
              <span className="hidden xl:inline">Add title</span>
            </button>
          </div>

          <div className="col-span-2 col-start-1 row-start-2 flex min-w-0 flex-wrap items-center gap-2 md:col-span-1 md:col-start-2 md:row-start-1 md:w-full md:flex-nowrap md:justify-center md:gap-0.5">
            <div
              className="relative w-full min-w-0 md:w-10 md:shrink-0 lg:w-[clamp(9rem,15vw,15rem)]"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setSearchOpen(false);
                }
              }}
            >
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/42 md:max-lg:left-2" />
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
                aria-label="Find a title in your slate"
                className="h-10 w-full rounded-2xl border border-white/12 bg-white/[0.065] pl-10 pr-10 text-sm text-white outline-none transition-[border-color,background-color] duration-150 placeholder:text-white/38 focus:border-primary/45 focus:bg-white/[0.09] sm:rounded-full sm:focus:border-primary/55 md:max-lg:pl-7 md:max-lg:pr-1"
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
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={openCommandPalette}
                      className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-xs text-white/72 transition-colors hover:bg-white/8 hover:text-white"
                    >
                      <span>Search and add a new title</span>
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ) : null}
            </div>

            <div className="scrollbar-hide w-full overflow-x-auto overscroll-x-contain pb-1 touch-pan-x md:w-max md:flex-none md:overflow-visible md:pb-0">
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
                popoverClassName="dark z-[90] border-white/12 bg-[#0c0e0d] text-white"
                groupControls
                reserveSortControl
                className="mb-0 w-max flex-nowrap gap-2 md:gap-1 [&_.filter-chip]:h-10 [&_.filter-chip]:border-white/12 [&_.filter-chip]:bg-white/[0.065] [&_.filter-chip]:text-white/60 [&_.filter-chip:hover]:text-white [&_.filter-chip[data-active=true]]:border-primary/45 [&_.filter-chip[data-active=true]]:bg-primary/15 [&_.filter-chip[data-active=true]]:text-primary [&_.filter-segment]:whitespace-nowrap [&_.filter-segment]:px-2.5 [&_.filter-segment:first-child]:px-3.5 [&_.filter-segmented]:h-10 [&_.filter-segmented]:border-white/12 [&_.filter-segmented]:bg-white/[0.055] [&_[data-filter-clear]]:px-3 md:[&_.filter-chip]:gap-1 md:[&_.filter-chip]:px-2 md:[&_.filter-segment]:px-1.5 md:[&_[data-filter-clear]]:w-10 md:[&_[data-filter-clear]]:justify-center md:[&_[data-filter-clear-label]]:hidden md:max-lg:[&_.filter-chip]:px-1.5 md:max-lg:[&_.filter-chip]:text-[10px] md:max-lg:[&_.filter-chip_.lucide-chevron-down]:hidden md:max-lg:[&_.filter-control-group]:gap-0.5 md:max-lg:[&_.filter-segment]:px-1 md:max-lg:[&_.filter-segment]:text-[10px] md:max-lg:[&_[data-filter-sentiment]]:w-10 md:max-lg:[&_[data-filter-sentiment]]:justify-center md:max-lg:[&_[data-filter-sentiment]]:px-0 md:max-lg:[&_[data-filter-sentiment-label]]:hidden md:max-lg:[&_[data-filter-sort]]:w-10 md:max-lg:[&_[data-filter-sort]]:justify-center md:max-lg:[&_[data-filter-sort]]:px-0 md:max-lg:[&_[data-filter-sort-label]]:hidden lg:[&_[data-filter-clear-label]]:inline lg:[&_.filter-segment]:px-2.5"
              />
            </div>
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
          className="relative min-h-0 flex-1 bg-[#080a09] will-change-[opacity,transform]"
        >
          <SpatialPosterGrid
            titles={filteredTitles}
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
