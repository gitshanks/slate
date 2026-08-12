"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Clock, Eye, LayoutGrid, Search, X } from "lucide-react";
import { FilterBar } from "@/components/filter-bar";
import { extractGenres, filterAndSort } from "@/lib/filter-utils";
import type { TitleRow } from "@/lib/types";

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

const STATUS_OPTIONS = [
  { value: "", label: "All", icon: LayoutGrid },
  { value: "want", label: "Watchlist", icon: Clock },
  { value: "watching", label: "Watching", icon: Eye },
  { value: "watched", label: "Watched", icon: Check },
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
  const searchRequestRef = React.useRef(0);
  const router = useRouter();
  const searchParams = useSearchParams();
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filterParams = React.useMemo(
    () => ({
      type: searchParams.get("type") ?? undefined,
      genre: searchParams.get("genre") ?? undefined,
      year: searchParams.get("year") ?? undefined,
      sentiment: searchParams.get("sentiment") ?? undefined,
    }),
    [searchParams],
  );
  const status = searchParams.get("spaceStatus");
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

  const selectSearchResult = React.useCallback(
    (title: TitleRow) => {
      setSearchOpen(false);
      focusTitle(title.id);
    },
    [focusTitle],
  );

  React.useEffect(() => {
    if (
      !searchOpen ||
      normalizedQuery.length < 2 ||
      matches.length === 0
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSearchOpen(false);
      focusTitle(matches[0].id);
    }, 320);
    return () => window.clearTimeout(timer);
  }, [focusTitle, matches, normalizedQuery, searchOpen]);

  React.useEffect(() => {
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);

  const keepSpaceOpen = React.useCallback(() => undefined, []);

  return (
    <>
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

        <div className="pointer-events-auto mx-auto flex w-full max-w-[1540px] items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5 pl-1 sm:pl-0.5">
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

          <button
            type="button"
            onClick={() => router.push("/login")}
            className="inline-flex h-8 shrink-0 items-center rounded-full border border-primary/25 bg-primary/10 px-3 text-[10px] font-semibold text-primary transition-[border-color,background-color,transform] duration-150 hover:border-primary/40 hover:bg-primary/15 active:scale-[0.97] sm:h-9 sm:border-0 sm:bg-primary sm:px-3.5 sm:text-xs sm:text-primary-foreground sm:hover:bg-primary/90"
          >
            Make your own
          </button>
        </div>

        <div className="pointer-events-auto mx-auto mt-2 flex w-full max-w-[1540px] flex-col gap-2 sm:mt-2.5 sm:flex-row sm:items-center sm:gap-2.5">
          <div
            className="relative min-w-0 shrink-0 sm:w-[clamp(14rem,25vw,24rem)]"
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

          <div className="-mx-1 min-w-0 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-1 sm:px-0">
            <FilterBar
              genres={genres}
              showSort={false}
              typeDisplay="menu"
              showSentiment
              sentimentDisplay="menu"
              statusOptions={STATUS_OPTIONS}
              statusParam="spaceStatus"
              idPrefix="space"
              popoverClassName="z-[80]"
              groupControls
              className="mb-0 w-max flex-nowrap gap-1.5 [&_.filter-chip]:border-white/12 [&_.filter-chip]:bg-white/[0.065] [&_.filter-chip]:text-white/60 [&_.filter-chip:hover]:text-white [&_.filter-segment]:whitespace-nowrap [&_.filter-segment]:px-2.5"
            />
          </div>
        </div>
      </header>

      <div className="fixed inset-0 z-40 bg-[#080a09]">
        <SpatialPosterGrid
          titles={filteredTitles}
          username={username}
          onExit={keepSpaceOpen}
          searchTarget={searchTarget}
        />
      </div>
    </>
  );
}
