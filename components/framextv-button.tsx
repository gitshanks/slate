"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  ExternalLink,
  ListVideo,
  Maximize,
  Minimize,
  Play,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { captureAnalytics } from "@/lib/analytics";
import { TMDB_IMG } from "@/lib/tmdb-image";
import { cn, formatRuntime } from "@/lib/utils";
import type { TitleStatus } from "@/lib/supabase";
import {
  getWatchedEpisodes,
  markMovieWatched,
  recordPlayback,
  setEpisodeWatched,
  setSeasonWatched,
  type EpisodeTrackingState,
} from "@/lib/episode-actions";
import {
  episodeKey,
  stepEpisode as stepEpisodeAcrossSeasons,
  type SeasonCount,
} from "@/lib/episode-progress";
import {
  FRAMEXTV_ORIGIN,
  frameXtvEpisodeEmbed,
  frameXtvEpisodeUrl,
  frameXtvMovieEmbed,
  frameXtvMovieUrl,
  frameXtvSeriesUrl,
  toFrameXtvSeasons,
  type FrameXtvEpisode,
  type FrameXtvSeason,
} from "@/lib/framextv";

const STATUS_LABELS: Record<TitleStatus, string> = {
  want: "Up Next",
  watching: "Watching",
  watched: "Watched",
  dropped: "Dropped",
};

const COMPLETION_THRESHOLD = 0.92;

/** Everything the frameXTV player needs for one title. */
export interface FrameXtvTarget {
  tmdbId: number;
  type: "movie" | "tv";
  /** Regular seasons for TV. Fetched lazily when omitted. */
  seasons?: FrameXtvSeason[] | null;
  /** The viewer's saved progress — preselects the season + resume link. */
  currentSeason?: number | null;
  currentEpisode?: number | null;
  /** Owned library row id. Omit for unsaved/shared titles (no tracking). */
  libraryId?: string | null;
  source?: string;
}

interface FrameXtvDialogProps extends FrameXtvTarget {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titleName: string;
}

function trackPlay(
  source: string,
  type: "movie" | "tv",
  season?: number,
  episode?: number,
) {
  captureAnalytics("ui_interaction", {
    control: "framextv_play",
    source,
    media_type: type,
    season: season ?? null,
    episode: episode ?? null,
  });
}

/**
 * The frameXTV player as a controlled dialog — plays natively in an in-app
 * embed. Movies start playing immediately; TV shows open a season/episode
 * picker with per-episode watched tracking that drives the library shelf
 * (Up Next → Watching → Watched) automatically. Opened from the frameXTV
 * entry in Where to watch.
 */
export function FrameXtvDialog({
  open,
  onOpenChange,
  tmdbId,
  type,
  titleName,
  seasons: seasonsProp,
  currentSeason,
  currentEpisode,
  libraryId,
  source = "title_detail",
}: FrameXtvDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        placement="center"
        size="lg"
        className="max-h-[90dvh] w-[calc(100vw-1.5rem)] overflow-hidden p-0"
      >
        <DialogTitle className="sr-only">
          Watch {titleName} on frameXTV
        </DialogTitle>
        {open && (
          <FrameXtvDialogBody
            tmdbId={tmdbId}
            type={type}
            titleName={titleName}
            seasons={seasonsProp}
            currentSeason={currentSeason}
            currentEpisode={currentEpisode}
            libraryId={libraryId}
            source={source}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function seasonCounts(seasons: FrameXtvSeason[]): SeasonCount[] {
  return seasons.map((s) => ({ n: s.season_number, c: s.episode_count }));
}

function FrameXtvDialogBody({
  tmdbId,
  type,
  titleName,
  seasons: seasonsProp,
  currentSeason: initialSeason,
  currentEpisode: initialEpisode,
  libraryId,
  source,
}: {
  tmdbId: number;
  type: "movie" | "tv";
  titleName: string;
  seasons?: FrameXtvSeason[] | null;
  currentSeason?: number | null;
  currentEpisode?: number | null;
  libraryId?: string | null;
  source: string;
}) {
  const router = useRouter();
  const [pointer, setPointer] = React.useState<{
    season: number;
    episode: number;
  } | null>(
    initialSeason != null && initialEpisode != null
      ? { season: initialSeason, episode: initialEpisode }
      : null,
  );
  const [watched, setWatched] = React.useState<Set<string>>(new Set());
  const [trackingReady, setTrackingReady] = React.useState(!libraryId);
  // Movies play immediately; TV starts on the picker (null = picker).
  const [player, setPlayer] = React.useState<{
    season: number;
    episode: number;
  } | null>(null);
  const [upNext, setUpNext] = React.useState<{
    season: number;
    episode: number;
    name: string | null;
  } | null>(null);
  const [seasonsState, setSeasonsState] = React.useState<FrameXtvSeason[] | null>(
    seasonsProp ? toFrameXtvSeasons(seasonsProp) : null,
  );
  const [seasonsError, setSeasonsError] = React.useState(false);
  const [episodeNames, setEpisodeNames] = React.useState<Record<string, string>>({});

  // Seasons passed from the server render win; otherwise fetch on open so
  // the player (prev/next, up-next) and picker share one list.
  React.useEffect(() => {
    if (seasonsProp) {
      setSeasonsState(toFrameXtvSeasons(seasonsProp));
      return;
    }
    let cancelled = false;
    fetch(`/api/tv/${tmdbId}/seasons`)
      .then((res) => {
        if (!res.ok) throw new Error(`seasons ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setSeasonsState(toFrameXtvSeasons(data.seasons));
      })
      .catch(() => {
        if (!cancelled) setSeasonsError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [seasonsProp, tmdbId]);

  const registerEpisodes = React.useCallback(
    (seasonNumber: number, episodes: FrameXtvEpisode[]) => {
      setEpisodeNames((prev) => {
        const next = { ...prev };
        for (const episode of episodes) {
          next[episodeKey(seasonNumber, episode.episode_number)] = episode.name;
        }
        return next;
      });
    },
    [],
  );

  const applyTracking = React.useCallback(
    (result: EpisodeTrackingState) => {
      setPointer(
        result.currentSeason != null && result.currentEpisode != null
          ? { season: result.currentSeason, episode: result.currentEpisode }
          : null,
      );
      setWatched(new Set(result.watched));
      if (result.statusChanged) {
        toast.success(`Moved to ${STATUS_LABELS[result.statusChanged]}`);
        router.refresh();
      }
    },
    [router],
  );

  // Load the saved watched set once per dialog session.
  React.useEffect(() => {
    if (!libraryId) return;
    let cancelled = false;
    getWatchedEpisodes(libraryId)
      .then((keys) => {
        if (!cancelled) {
          setWatched(new Set(keys));
          setTrackingReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) setTrackingReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [libraryId]);

  const handlePlay = React.useCallback(
    (season: number | null, episode: number | null) => {
      if (season !== null && episode !== null) setPlayer({ season, episode });
      setUpNext(null);
      trackPlay(source, type, season ?? undefined, episode ?? undefined);
      if (libraryId) {
        void recordPlayback({ titleId: libraryId, season, episode })
          .then(applyTracking)
          .catch(() => {});
      }
    },
    [applyTracking, libraryId, source, type],
  );

  const handleComplete = React.useCallback(
    (season: number | null, episode: number | null) => {
      if (season !== null && episode !== null) {
        const next = stepEpisodeAcrossSeasons(
          seasonCounts(seasonsState ?? []),
          season,
          episode,
          1,
        );
        if (next) {
          setUpNext({
            ...next,
            name: episodeNames[episodeKey(next.season, next.episode)] ?? null,
          });
        }
      }
      if (!libraryId) return;
      if (season !== null && episode !== null) {
        void setEpisodeWatched({ titleId: libraryId, season, episode, watched: true })
          .then(applyTracking)
          .catch(() => {});
      } else {
        void markMovieWatched(libraryId).then(applyTracking).catch(() => {});
      }
    },
    [applyTracking, episodeNames, libraryId, seasonsState],
  );

  if (type === "movie") {
    return (
      <FrameXtvPlayer
        tmdbId={tmdbId}
        titleName={titleName}
        season={null}
        episode={null}
        seasons={[]}
        onBack={null}
        onSelect={null}
        onPlayActivity={() => handlePlay(null, null)}
        onCompleted={() => handleComplete(null, null)}
        upNext={null}
        onPlayNext={null}
        onBrowseEpisodes={null}
      />
    );
  }

  if (player) {
    return (
      <FrameXtvPlayer
        tmdbId={tmdbId}
        titleName={titleName}
        season={player.season}
        episode={player.episode}
        seasons={seasonsState ?? []}
        onBack={() => {
          setPlayer(null);
          setUpNext(null);
        }}
        onSelect={(season, episode) => handlePlay(season, episode)}
        onPlayActivity={() => handlePlay(player.season, player.episode)}
        onCompleted={() => handleComplete(player.season, player.episode)}
        upNext={upNext}
        onPlayNext={
          upNext
            ? () => handlePlay(upNext.season, upNext.episode)
            : null
        }
        onBrowseEpisodes={() => {
          setPlayer(null);
          setUpNext(null);
        }}
      />
    );
  }

  return (
    <div className="p-4">
      <p className="pr-8 text-sm font-semibold">Watch on frameXTV</p>
      <FrameXtvEpisodePicker
        tmdbId={tmdbId}
        titleName={titleName}
        seasons={seasonsState}
        seasonsError={seasonsError}
        pointer={pointer}
        watched={watched}
        trackingReady={trackingReady}
        libraryId={libraryId}
        applyTracking={applyTracking}
        onEpisodesLoaded={registerEpisodes}
        onSelect={(season, episode) => handlePlay(season, episode)}
      />
    </div>
  );
}

function FrameXtvPlayer({
  tmdbId,
  titleName,
  season,
  episode,
  seasons,
  onBack,
  onSelect,
  onPlayActivity,
  onCompleted,
  upNext,
  onPlayNext,
  onBrowseEpisodes,
}: {
  tmdbId: number;
  titleName: string;
  season: number | null;
  episode: number | null;
  seasons: FrameXtvSeason[];
  onBack: (() => void) | null;
  onSelect: ((season: number, episode: number) => void) | null;
  /** Fired once real playback starts (telemetry), and on explicit play. */
  onPlayActivity: () => void;
  /** Fired once playback crosses the completion threshold. */
  onCompleted: () => void;
  upNext: { season: number; episode: number; name: string | null } | null;
  onPlayNext: (() => void) | null;
  onBrowseEpisodes: (() => void) | null;
}) {
  const src =
    season !== null && episode !== null
      ? frameXtvEpisodeEmbed(tmdbId, season, episode, { title: titleName })
      : frameXtvMovieEmbed(tmdbId, { title: titleName });
  const watchUrl =
    season !== null && episode !== null
      ? frameXtvEpisodeUrl(tmdbId, season, episode)
      : frameXtvMovieUrl(tmdbId);

  const playerKey = season !== null && episode !== null ? `${season}:${episode}` : "movie";
  const activityRef = React.useRef<Set<string>>(new Set());
  const completedRef = React.useRef<Set<string>>(new Set());
  const callbacksRef = React.useRef({ onPlayActivity, onCompleted });
  React.useEffect(() => {
    callbacksRef.current = { onPlayActivity, onCompleted };
  });

  // The embed reports real playback telemetry (docs: postMessage API).
  // Playback starting counts as activity; crossing ~92% counts as watched.
  // Origin-checked: only the frameXTV player we loaded can drive tracking.
  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== FRAMEXTV_ORIGIN) return;
      const data = event.data as
        | { event?: unknown; currentTime?: unknown; duration?: unknown }
        | null;
      if (!data || typeof data !== "object" || data.event !== "frameXTV:timeupdate") {
        return;
      }
      const { currentTime, duration } = data;
      if (
        typeof currentTime !== "number" ||
        typeof duration !== "number" ||
        !Number.isFinite(currentTime) ||
        !Number.isFinite(duration) ||
        duration <= 0
      ) {
        return;
      }
      const progress = currentTime / duration;
      if (progress > 0.03 && !activityRef.current.has(playerKey)) {
        activityRef.current.add(playerKey);
        callbacksRef.current.onPlayActivity();
      }
      if (progress >= COMPLETION_THRESHOLD && !completedRef.current.has(playerKey)) {
        completedRef.current.add(playerKey);
        callbacksRef.current.onCompleted();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [playerKey]);

  const counts = seasonCounts(seasons);
  const prev =
    season !== null && episode !== null
      ? stepEpisodeAcrossSeasons(counts, season, episode, -1)
      : null;
  const next =
    season !== null && episode !== null
      ? stepEpisodeAcrossSeasons(counts, season, episode, 1)
      : null;

  // Our own chrome goes fullscreen — the player's built-in buttons also
  // fire popups/ads, so the iframe below is sandboxed to block those.
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  React.useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement != null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = React.useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
      return;
    }
    try {
      const request = containerRef.current?.requestFullscreen();
      if (request instanceof Promise) void request.catch(() => {});
    } catch {
      // Fullscreen unavailable — the inline player still works.
    }
  }, []);

  const label =
    season !== null && episode !== null
      ? `S${season} E${episode}`
      : titleName;

  return (
    <div ref={containerRef} className="min-w-0 bg-background">
      <div className="flex items-center gap-1 px-2 pt-2 sm:gap-2 sm:px-3 sm:pt-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to episodes"
            className="grid h-9 w-9 shrink-0 touch-manipulation place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </button>
        )}
        <p className="min-w-0 flex-1 truncate px-1 text-sm font-semibold">
          {season !== null && episode !== null ? (
            <>
              <span className="font-mono text-xs text-muted-foreground">
                {label} ·{" "}
              </span>
              {titleName}
            </>
          ) : (
            titleName
          )}
        </p>
        {prev && onSelect && (
          <button
            type="button"
            onClick={() => onSelect(prev.season, prev.episode)}
            aria-label={`Previous episode (S${prev.season} E${prev.episode})`}
            className="grid h-9 w-9 shrink-0 touch-manipulation place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
        )}
        {next && onSelect && (
          <button
            type="button"
            onClick={() => onSelect(next.season, next.episode)}
            aria-label={`Next episode (S${next.season} E${next.episode})`}
            className="grid h-9 w-9 shrink-0 touch-manipulation place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          className="grid h-9 w-9 shrink-0 touch-manipulation place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {isFullscreen ? (
            <Minimize className="h-4 w-4" aria-hidden />
          ) : (
            <Maximize className="h-4 w-4" aria-hidden />
          )}
        </button>
        <a
          href={watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open on framextv.xyz"
          title="Open on framextv.xyz"
          className="grid h-9 w-9 shrink-0 touch-manipulation place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
        </a>
      </div>
      <div className="px-2 pb-2 pt-1 sm:px-3 sm:pb-3">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
          <iframe
            key={src}
            src={src}
            title={`${titleName}${label !== titleName ? ` ${label}` : ""} on frameXTV`}
            // Sandboxed: scripts + same-origin keep the player working, but
            // popups, new tabs, top-level navigation, and modal spam stay
            // blocked. The embed redirects to another frameXTV domain, so
            // the allow list uses * — the default ('src') would stop the
            // player's own fullscreen button.
            sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
            allow="autoplay *; fullscreen *; encrypted-media *; picture-in-picture *"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
          />
          {upNext && onPlayNext && onBrowseEpisodes && (
            <div className="absolute inset-x-3 bottom-3 overflow-hidden rounded-xl border border-border bg-background/90 shadow-xl backdrop-blur-xl">
              <div className="flex items-center gap-3 p-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary font-mono text-xs font-bold text-primary-foreground">
                  E{upNext.episode}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Up next · S{upNext.season} E{upNext.episode}
                  </span>
                  <span className="block truncate text-sm font-semibold">
                    {upNext.name ?? titleName}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={onPlayNext}
                  className="inline-flex h-9 shrink-0 touch-manipulation items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground transition-transform active:scale-[0.97]"
                >
                  <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
                  Play
                </button>
                <button
                  type="button"
                  onClick={onBrowseEpisodes}
                  aria-label="Back to episodes"
                  className="grid h-9 w-9 shrink-0 touch-manipulation place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ListVideo className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
          )}
        </div>
        <p className="mt-2 hidden text-[11px] text-muted-foreground sm:block">
          Stream provided by frameXTV
        </p>
      </div>
    </div>
  );
}

function FrameXtvEpisodePicker({
  tmdbId,
  titleName,
  seasons: seasonsProp,
  seasonsError,
  pointer,
  watched,
  trackingReady,
  libraryId,
  applyTracking,
  onEpisodesLoaded,
  onSelect,
}: {
  tmdbId: number;
  titleName: string;
  seasons: FrameXtvSeason[] | null;
  seasonsError: boolean;
  pointer: { season: number; episode: number } | null;
  watched: Set<string>;
  trackingReady: boolean;
  libraryId?: string | null;
  applyTracking: (result: EpisodeTrackingState) => void;
  onEpisodesLoaded: (season: number, episodes: FrameXtvEpisode[]) => void;
  onSelect: (season: number, episode: number) => void;
}) {
  const seasons = seasonsProp ? toFrameXtvSeasons(seasonsProp) : null;
  const [activeSeason, setActiveSeason] = React.useState<number | null>(null);
  const [reversed, setReversed] = React.useState(false);
  const [episodesBySeason, setEpisodesBySeason] = React.useState<
    Record<number, FrameXtvEpisode[]>
  >({});
  const [loadingSeason, setLoadingSeason] = React.useState<number | null>(null);
  const [failedSeason, setFailedSeason] = React.useState<number | null>(null);
  const [toggling, setToggling] = React.useState<string | null>(null);

  // Default to the viewer's resume point, else season 1.
  React.useEffect(() => {
    if (!seasons || seasons.length === 0 || activeSeason !== null) return;
    const resume = seasons.some((s) => s.season_number === pointer?.season)
      ? (pointer as { season: number; episode: number }).season
      : (seasons[0]?.season_number ?? null);
    setActiveSeason(resume);
  }, [seasons, activeSeason, pointer]);

  const loadSeason = React.useCallback(
    async (seasonNumber: number) => {
      setActiveSeason(seasonNumber);
      if (episodesBySeason[seasonNumber]) return;
      setLoadingSeason(seasonNumber);
      setFailedSeason(null);
      try {
        const res = await fetch(`/api/tv/${tmdbId}/season/${seasonNumber}`);
        if (!res.ok) throw new Error(`season ${res.status}`);
        const data = await res.json();
        const loaded = (data.episodes ?? []) as FrameXtvEpisode[];
        setEpisodesBySeason((prev) => ({
          ...prev,
          [seasonNumber]: loaded,
        }));
        onEpisodesLoaded(seasonNumber, loaded);
      } catch {
        setFailedSeason(seasonNumber);
      } finally {
        setLoadingSeason((current) =>
          current === seasonNumber ? null : current,
        );
      }
    },
    [episodesBySeason, onEpisodesLoaded, tmdbId],
  );

  React.useEffect(() => {
    if (activeSeason !== null && !episodesBySeason[activeSeason]) {
      void loadSeason(activeSeason);
    }
    // Only auto-load on season switch; loadSeason identity changes per cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSeason]);

  const toggleEpisode = React.useCallback(
    (seasonNumber: number, episodeNumber: number, isWatched: boolean) => {
      if (!libraryId) return;
      const key = episodeKey(seasonNumber, episodeNumber);
      setToggling(key);
      setEpisodeWatched({
        titleId: libraryId,
        season: seasonNumber,
        episode: episodeNumber,
        watched: !isWatched,
      })
        .then(applyTracking)
        .catch(() => {
          toast.error("Could not save — try again");
        })
        .finally(() => {
          setToggling((current) => (current === key ? null : current));
        });
    },
    [applyTracking, libraryId],
  );

  const toggleSeason = React.useCallback(
    (seasonNumber: number, episodeCount: number, allWatched: boolean) => {
      if (!libraryId) return;
      setSeasonWatched({
        titleId: libraryId,
        season: seasonNumber,
        episodeCount,
        watched: !allWatched,
      })
        .then(applyTracking)
        .catch(() => {
          toast.error("Could not save — try again");
        });
    },
    [applyTracking, libraryId],
  );

  if (seasonsError) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-muted-foreground">
          Seasons are unavailable right now.
        </p>
        <a
          href={frameXtvSeriesUrl(tmdbId)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          Open {titleName} on frameXTV
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>
    );
  }

  if (!seasons || !trackingReady) {
    return (
      <div className="grid grid-cols-4 gap-2 py-2" aria-label="Loading seasons">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-9 animate-pulse rounded-full bg-muted/60"
          />
        ))}
      </div>
    );
  }

  if (seasons.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No seasons found for this title.
      </p>
    );
  }

  const counts = seasonCounts(seasons);
  const total = counts.reduce((sum, s) => sum + s.c, 0);
  const watchedCount = counts.reduce(
    (sum, s) =>
      sum +
      Array.from({ length: s.c }, (_, i) => i + 1).filter((e) =>
        watched.has(episodeKey(s.n, e)),
      ).length,
    0,
  );
  const percent = total > 0 ? Math.round((watchedCount / total) * 100) : 0;

  const episodes =
    activeSeason !== null ? (episodesBySeason[activeSeason] ?? null) : null;
  const activeCount = counts.find((s) => s.n === activeSeason)?.c ?? 0;
  const activeWatched =
    activeSeason !== null
      ? Array.from({ length: activeCount }, (_, i) => i + 1).filter((e) =>
          watched.has(episodeKey(activeSeason, e)),
        ).length
      : 0;
  const seasonComplete = activeCount > 0 && activeWatched >= activeCount;
  const orderedEpisodes = reversed ? episodes?.slice().reverse() : episodes;

  return (
    <div className="min-h-0">
      {libraryId && total > 0 && (
        <div className="mb-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-mono text-[11px] text-muted-foreground">
              {watchedCount} of {total} watched
            </p>
            <p className="font-mono text-[11px] font-semibold text-foreground">
              {percent}%
            </p>
          </div>
          <div
            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${watchedCount} of ${total} episodes watched`}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}

      {pointer && (
        <button
          type="button"
          onClick={() => onSelect(pointer.season, pointer.episode)}
          className="mb-3 flex w-full items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-left transition-colors hover:bg-primary/15"
        >
          <Play className="h-4 w-4 shrink-0 fill-current text-primary" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {watched.has(episodeKey(pointer.season, pointer.episode))
              ? `Rewatch S${pointer.season} E${pointer.episode}`
              : `Continue S${pointer.season} E${pointer.episode}`}
          </span>
        </button>
      )}

      <div
        className="scrollbar-hide -mx-1 flex gap-1.5 overflow-x-auto overscroll-x-contain px-1 pb-1"
        role="tablist"
        aria-label="Seasons"
      >
        {seasons.map((season) => {
          const active = season.season_number === activeSeason;
          return (
            <button
              key={season.season_number}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => void loadSeason(season.season_number)}
              className={cn(
                "h-9 shrink-0 touch-manipulation rounded-full border px-3.5 font-mono text-xs transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              S{season.season_number}
            </button>
          );
        })}
      </div>

      {activeSeason !== null && activeCount > 0 && (
        <div className="mt-1 flex items-center justify-between gap-2 px-0.5">
          <p className="font-mono text-[11px] text-muted-foreground">
            Season {activeSeason} · {activeWatched} of {activeCount} watched
          </p>
          <div className="flex items-center gap-1">
            {libraryId && (
              <button
                type="button"
                onClick={() => toggleSeason(activeSeason, activeCount, seasonComplete)}
                className="rounded-full px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {seasonComplete ? "Clear season" : "Mark season"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setReversed((v) => !v)}
              aria-label={reversed ? "Show oldest first" : "Show newest first"}
              title={reversed ? "Oldest first" : "Newest first"}
              className={cn(
                "grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-muted",
                reversed ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ArrowUpDown className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>
      )}

      {!libraryId && (
        <p className="mt-2 flex items-center gap-1.5 rounded-xl border border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Add this title to your library to track episodes.
        </p>
      )}

      <div className="mt-2 max-h-[46dvh] min-h-0 overflow-y-auto overscroll-contain pr-0.5">
        {loadingSeason !== null && !episodes ? (
          <div className="grid grid-cols-1 gap-2" aria-label="Loading episodes">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-[68px] animate-pulse rounded-xl bg-muted/60"
              />
            ))}
          </div>
        ) : failedSeason !== null && !episodes ? (
          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Episodes are unavailable right now.
            </p>
            <button
              type="button"
              onClick={() => {
                setFailedSeason(null);
                if (activeSeason !== null) void loadSeason(activeSeason);
              }}
              className="mt-2 text-sm font-medium text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        ) : (episodes ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No episodes found for this season.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {(orderedEpisodes ?? []).map((episode) => {
              const runtime = formatRuntime(episode.runtime);
              const key = episodeKey(activeSeason as number, episode.episode_number);
              const isWatched = watched.has(key);
              const isCurrent =
                pointer?.season === activeSeason &&
                pointer?.episode === episode.episode_number;
              const busy = toggling === key;
              return (
                <div
                  key={episode.episode_number}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-xl border p-2 transition-colors",
                    isCurrent
                      ? "border-primary/45 bg-primary/[0.07]"
                      : "border-border bg-card/50 hover:border-primary/40 hover:bg-card",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(activeSeason as number, episode.episode_number)}
                    aria-label={`Play S${activeSeason} E${episode.episode_number}: ${episode.name}`}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    {episode.still_path ? (
                      <span className="relative block h-[54px] w-24 shrink-0 overflow-hidden rounded-lg ring-1 ring-border/45">
                        <Image
                          src={`${TMDB_IMG}/w185${episode.still_path}`}
                          alt=""
                          width={96}
                          height={54}
                          className="h-full w-full object-cover"
                        />
                        {isWatched && (
                          <span className="absolute inset-0 bg-background/45" aria-hidden />
                        )}
                      </span>
                    ) : (
                      <span className="grid h-[54px] w-24 shrink-0 place-items-center rounded-lg bg-muted font-mono text-sm font-semibold text-muted-foreground ring-1 ring-border/45">
                        E{episode.episode_number}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        E{episode.episode_number} · {episode.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {[
                          runtime,
                          episode.air_date ? episode.air_date.slice(0, 4) : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || " "}
                      </span>
                    </span>
                    {isCurrent ? (
                      <Play
                        aria-hidden
                        className="h-4 w-4 shrink-0 fill-current text-primary"
                      />
                    ) : (
                      <Play
                        aria-hidden
                        className="h-4 w-4 shrink-0 fill-current text-muted-foreground/40 transition-colors group-hover:text-primary"
                      />
                    )}
                  </button>
                  {libraryId ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => toggleEpisode(activeSeason as number, episode.episode_number, isWatched)}
                      aria-pressed={isWatched}
                      aria-label={
                        isWatched
                          ? `Mark S${activeSeason} E${episode.episode_number} as unwatched`
                          : `Mark S${activeSeason} E${episode.episode_number} as watched`
                      }
                      title={isWatched ? "Watched — tap to unmark" : "Mark as watched"}
                      className={cn(
                        "grid h-9 w-9 shrink-0 touch-manipulation place-items-center rounded-full border transition-all active:scale-95 disabled:opacity-50",
                        isWatched
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-transparent hover:border-primary/60 hover:text-primary/50",
                      )}
                    >
                      {isWatched ? (
                        <Check className="h-4 w-4" aria-hidden strokeWidth={3} />
                      ) : (
                        <Circle className="h-4 w-4" aria-hidden />
                      )}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <a
        href={frameXtvSeriesUrl(tmdbId)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        Open series page on frameXTV
        <ExternalLink className="h-3 w-3" aria-hidden />
      </a>
    </div>
  );
}
