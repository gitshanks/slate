"use client";

import * as React from "react";
import {
  Check,
  ChevronDown,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { CollectionTitleDetailOverlay } from "@/components/spatial-poster-grid";
import {
  DiscoverTitleOverlayContext,
  type DiscoverTitleOverlayContextValue,
} from "@/components/discover-title-overlay-context";
import { StatusPill } from "@/components/status-pill";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { addTitle } from "@/lib/actions";
import {
  clearDiscoverTitleDetailCache,
  getCachedDiscoverTitleDetail,
  loadDiscoverTitleDetail,
  updateCachedDiscoverTitleSavedTitle,
} from "@/lib/discover-title-detail-cache";
import type {
  PublicSpatialSavedTitle,
  PublicSpatialTitleDetail,
} from "@/lib/public-spatial-detail-types";
import type { TmdbSearchResult } from "@/lib/tmdb";
import type { TitleRow, TitleStatus } from "@/lib/types";

interface DiscoverSelection {
  title: TitleRow;
  anchorElementId: string;
  savedFallback: boolean;
}

interface SavedState {
  saved: boolean;
  record: PublicSpatialSavedTitle | null;
}

const detailSource = {
  getCached: (title: TitleRow) => getCachedDiscoverTitleDetail(title),
  load: (title: TitleRow) => loadDiscoverTitleDetail(title),
};

function itemKey(item: Pick<TmdbSearchResult, "id" | "media_type">) {
  return `${item.media_type === "tv" ? "tv" : "movie"}:${item.id}`;
}

function titleKey(title: Pick<TitleRow, "tmdb_id" | "media_type">) {
  return `${title.media_type}:${title.tmdb_id}`;
}

function catalogueTitle(item: TmdbSearchResult): TitleRow {
  const mediaType = item.media_type === "tv" ? "tv" : "movie";
  return {
    id: `discover-${mediaType}-${item.id}`,
    tmdb_id: item.id,
    media_type: mediaType,
    title: item.title || item.name || "Untitled",
    original_title: item.original_title || item.original_name || null,
    overview: item.overview || null,
    poster_path: item.poster_path,
    backdrop_path: item.backdrop_path,
    release_date: item.release_date || item.first_air_date || null,
    runtime: null,
    genres: null,
    status: "want",
    rating: null,
    review: null,
    favorite: false,
    added_at: "1970-01-01T00:00:00.000Z",
    watched_at: null,
    tmdb_rating: item.vote_average ?? null,
    tmdb_vote_count: null,
    imdb_id: null,
    omdb_plot: null,
    omdb_plot_fetched_at: null,
    imdb_rating: null,
    imdb_votes: null,
    rt_score: null,
    metacritic_score: null,
    ratings_fetched_at: null,
    current_season: null,
    current_episode: null,
    seasons: null,
  };
}

const STATUS_OPTIONS: {
  value: Exclude<TitleStatus, "dropped">;
  label: string;
}[] = [
  { value: "want", label: "Up Next" },
  { value: "watching", label: "Watching" },
  { value: "watched", label: "Watched" },
];

function DiscoverTitleActions({
  title,
  detail,
  savedFallback,
  savedState,
  onSaved,
}: {
  title: TitleRow;
  detail: PublicSpatialTitleDetail | null;
  savedFallback: boolean;
  savedState: SavedState | undefined;
  onSaved: (record: PublicSpatialSavedTitle) => void;
}) {
  const [isPending, startTransition] = React.useTransition();
  const detailRecord = detail?.savedTitle ?? null;
  const record = savedState?.record ?? detailRecord;
  const saved =
    savedState?.saved ?? (savedFallback || Boolean(detailRecord));

  React.useEffect(() => {
    if (detailRecord && !savedState?.record) onSaved(detailRecord);
  }, [detailRecord, onSaved, savedState?.record]);

  if (record) {
    return (
      <StatusPill
        titleId={record.id}
        status={record.status}
        onStatusChange={(status) => onSaved({ ...record, status })}
      />
    );
  }

  if (saved) {
    return (
      <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3.5 text-xs font-medium text-primary">
        <Check className="h-3.5 w-3.5" />
        In your library
      </span>
    );
  }

  // A tile can appear in AI results before Discover knows whether it is
  // already saved. Wait for that single ownership lookup so an existing title
  // can never receive a false "Added" toast or an invented status.
  if (!detail) {
    return (
      <span className="inline-flex h-9 items-center rounded-full border border-border bg-background/45 px-3.5 text-xs font-medium text-muted-foreground">
        Checking library&hellip;
      </span>
    );
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={isPending}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-background/55 px-3.5 text-xs font-medium text-foreground shadow-sm transition-[background-color,border-color,transform] hover:border-primary/35 hover:bg-accent active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{isPending ? "Adding…" : "Add to library"}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="z-[80] min-w-[10rem]">
        {STATUS_OPTIONS.map(({ value, label }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => {
              startTransition(async () => {
                try {
                  const row = await addTitle({
                    tmdbId: title.tmdb_id,
                    mediaType: title.media_type,
                    status: value,
                  });
                  if (!row?.id) throw new Error("Title could not be added.");
                  const savedStatus = row.status ?? value;
                  onSaved({ id: row.id, status: savedStatus });
                  const savedLabel =
                    STATUS_OPTIONS.find((option) => option.value === savedStatus)
                      ?.label ?? label;
                  toast.success(`In ${savedLabel}`);
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Title could not be added.",
                  );
                }
              });
            }}
          >
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DiscoverTitleOverlayProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [selection, setSelection] = React.useState<DiscoverSelection | null>(
    null,
  );
  const [savedTitles, setSavedTitles] = React.useState<
    Map<string, SavedState>
  >(() => new Map());

  React.useEffect(
    () => () => {
      clearDiscoverTitleDetailCache();
    },
    [],
  );

  const rememberSaved = React.useCallback(
    (title: Pick<TitleRow, "media_type" | "tmdb_id">, record: PublicSpatialSavedTitle | null) => {
      const key = titleKey(title);
      if (record) updateCachedDiscoverTitleSavedTitle(title, record);
      setSavedTitles((current) => {
        const existing = current.get(key);
        if (existing?.record && !record) return current;
        if (
          existing?.saved &&
          existing.record?.id === record?.id &&
          existing.record?.status === record?.status
        ) {
          return current;
        }
        const next = new Map(current);
        next.set(key, { saved: true, record });
        return next;
      });
    },
    [],
  );

  const prefetch = React.useCallback((item: TmdbSearchResult) => {
    if (item.media_type !== "movie" && item.media_type !== "tv") return;
    void loadDiscoverTitleDetail(catalogueTitle(item)).catch(() => undefined);
  }, []);

  const open = React.useCallback(
    (item: TmdbSearchResult, saved: boolean, anchorElementId: string) => {
      if (item.media_type !== "movie" && item.media_type !== "tv") return;
      const title = catalogueTitle(item);
      if (saved) rememberSaved(title, null);
      void loadDiscoverTitleDetail(title).catch(() => undefined);
      setSelection({ title, anchorElementId, savedFallback: saved });
    },
    [rememberSaved],
  );

  const isSaved = React.useCallback(
    (item: TmdbSearchResult, fallback: boolean) =>
      savedTitles.get(itemKey(item))?.saved ?? fallback,
    [savedTitles],
  );

  const savedRecord = React.useCallback(
    (item: TmdbSearchResult) =>
      savedTitles.get(itemKey(item))?.record ?? null,
    [savedTitles],
  );

  const markSaved = React.useCallback(
    (item: TmdbSearchResult, record: PublicSpatialSavedTitle) => {
      if (item.media_type !== "movie" && item.media_type !== "tv") return;
      rememberSaved(
        { media_type: item.media_type, tmdb_id: item.id },
        record,
      );
    },
    [rememberSaved],
  );

  const context = React.useMemo<DiscoverTitleOverlayContextValue>(
    () => ({
      selectedAnchorElementId: selection?.anchorElementId ?? null,
      hasSelection: selection !== null,
      open,
      prefetch,
      isSaved,
      savedRecord,
      markSaved,
    }),
    [isSaved, markSaved, open, prefetch, savedRecord, selection],
  );

  const renderActions = React.useCallback(
    (title: TitleRow, detail: PublicSpatialTitleDetail | null) => {
      if (!selection) return null;
      const key = titleKey(title);
      return (
        <DiscoverTitleActions
          title={title}
          detail={detail}
          savedFallback={selection.savedFallback}
          savedState={savedTitles.get(key)}
          onSaved={(record) => rememberSaved(title, record)}
        />
      );
    },
    [rememberSaved, savedTitles, selection],
  );

  return (
    <DiscoverTitleOverlayContext.Provider value={context}>
      {children}
      {selection ? (
        <CollectionTitleDetailOverlay
          key={selection.anchorElementId}
          title={selection.title}
          detailSource={detailSource}
          renderActions={renderActions}
          anchorElementId={selection.anchorElementId}
          scrollContainerId="app-scroll-area"
          centerAfterId="app-top-nav"
          onClose={() => setSelection(null)}
        />
      ) : null}
    </DiscoverTitleOverlayContext.Provider>
  );
}
