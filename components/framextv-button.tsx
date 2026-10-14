"use client";

import * as React from "react";
import Image from "next/image";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Maximize,
  Minimize,
  Play,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { ActionRow } from "@/components/action-row";
import { captureAnalytics } from "@/lib/analytics";
import { TMDB_IMG } from "@/lib/tmdb-image";
import { cn, formatRuntime } from "@/lib/utils";
import {
  frameXtvEpisodeEmbed,
  frameXtvEpisodeUrl,
  frameXtvMovieEmbed,
  frameXtvMovieUrl,
  frameXtvSeriesUrl,
  toFrameXtvSeasons,
  type FrameXtvEpisode,
  type FrameXtvSeason,
} from "@/lib/framextv";

interface FrameXtvButtonProps {
  tmdbId: number;
  type: "movie" | "tv";
  titleName: string;
  /** "pill" (default, desktop row) or "row" (mobile More sheet). */
  variant?: "pill" | "row";
  /** Regular seasons for TV. Fetched lazily when omitted. */
  seasons?: FrameXtvSeason[] | null;
  /** The viewer's saved progress — preselects the season + resume link. */
  currentSeason?: number | null;
  currentEpisode?: number | null;
  source?: string;
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

function pillClassName(): string {
  return "inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-card/80";
}

/**
 * "Watch now" via frameXTV — plays natively in an in-app embed dialog.
 * Movies start playing immediately; TV shows open a season/episode picker
 * that loads each episode in the same player.
 */
export function FrameXtvButton({
  tmdbId,
  type,
  titleName,
  variant = "pill",
  seasons: seasonsProp,
  currentSeason,
  currentEpisode,
  source = "title_detail",
}: FrameXtvButtonProps) {
  const [open, setOpen] = React.useState(false);

  const trigger =
    variant === "row" ? (
      <ActionRow
        icon={<Play className="h-[18px] w-[18px] fill-current" />}
        label="Watch on frameXTV"
        sublabel={type === "movie" ? "Play now" : "Pick a season and episode"}
        onClick={() => setOpen(true)}
      />
    ) : (
      <button
        type="button"
        data-analytics-action="watch_framextv"
        aria-label={`Watch ${titleName} on frameXTV`}
        title="Watch on frameXTV"
        onClick={() => setOpen(true)}
        className={pillClassName()}
      >
        <Play className="h-3.5 w-3.5 fill-current" />
        Watch now
      </button>
    );

  return (
    <>
      {trigger}
      <Dialog open={open} onOpenChange={setOpen}>
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
              source={source}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function FrameXtvDialogBody({
  tmdbId,
  type,
  titleName,
  seasons,
  currentSeason,
  currentEpisode,
  source,
}: {
  tmdbId: number;
  type: "movie" | "tv";
  titleName: string;
  seasons?: FrameXtvSeason[] | null;
  currentSeason?: number | null;
  currentEpisode?: number | null;
  source: string;
}) {
  // Movies play immediately; TV starts on the picker (null = picker).
  const [player, setPlayer] = React.useState<{
    season: number;
    episode: number;
  } | null>(null);

  React.useEffect(() => {
    if (type === "movie") trackPlay(source, type);
  }, [source, type]);

  if (type === "movie") {
    return (
      <FrameXtvPlayer
        tmdbId={tmdbId}
        titleName={titleName}
        season={null}
        episode={null}
        seasons={[]}
        onBack={null}
        onStep={null}
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
        seasons={seasons ? toFrameXtvSeasons(seasons) : []}
        onBack={() => setPlayer(null)}
        onStep={(season, episode) => {
          setPlayer({ season, episode });
          trackPlay(source, type, season, episode);
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
        seasons={seasons}
        currentSeason={currentSeason}
        currentEpisode={currentEpisode}
        onSelect={(season, episode) => {
          setPlayer({ season, episode });
          trackPlay(source, type, season, episode);
        }}
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
  onStep,
}: {
  tmdbId: number;
  titleName: string;
  season: number | null;
  episode: number | null;
  seasons: FrameXtvSeason[];
  onBack: (() => void) | null;
  onStep: ((season: number, episode: number) => void) | null;
}) {
  const src =
    season !== null && episode !== null
      ? frameXtvEpisodeEmbed(tmdbId, season, episode, { title: titleName })
      : frameXtvMovieEmbed(tmdbId, { title: titleName });
  const watchUrl =
    season !== null && episode !== null
      ? frameXtvEpisodeUrl(tmdbId, season, episode)
      : frameXtvMovieUrl(tmdbId);

  const prev = season !== null && episode !== null
    ? stepEpisode(seasons, season, episode, -1)
    : null;
  const next = season !== null && episode !== null
    ? stepEpisode(seasons, season, episode, 1)
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
        {prev && onStep && (
          <button
            type="button"
            onClick={() => onStep(prev.season, prev.episode)}
            aria-label={`Previous episode (S${prev.season} E${prev.episode})`}
            className="grid h-9 w-9 shrink-0 touch-manipulation place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
        )}
        {next && onStep && (
          <button
            type="button"
            onClick={() => onStep(next.season, next.episode)}
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
            // blocked. Fullscreen is handled by our own header button.
            sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
          />
        </div>
        <p className="mt-2 hidden text-[11px] text-muted-foreground sm:block">
          Stream provided by frameXTV
        </p>
      </div>
    </div>
  );
}

/** Step one episode across season boundaries using TMDB episode counts. */
function stepEpisode(
  seasons: FrameXtvSeason[],
  season: number,
  episode: number,
  direction: -1 | 1,
): { season: number; episode: number } | null {
  const ordered = seasons.slice().sort((a, b) => a.season_number - b.season_number);
  const current = ordered.find((s) => s.season_number === season);
  const count = current?.episode_count ?? null;

  if (direction === 1) {
    if (count !== null && episode < count) return { season, episode: episode + 1 };
    if (count === null) return { season, episode: episode + 1 };
    const nextSeason = ordered.find((s) => s.season_number > season);
    return nextSeason ? { season: nextSeason.season_number, episode: 1 } : null;
  }

  if (episode > 1) return { season, episode: episode - 1 };
  const prevSeason = ordered
    .slice()
    .reverse()
    .find((s) => s.season_number < season);
  return prevSeason ? { season: prevSeason.season_number, episode: prevSeason.episode_count } : null;
}

function FrameXtvEpisodePicker({
  tmdbId,
  titleName,
  seasons: seasonsProp,
  currentSeason,
  currentEpisode,
  onSelect,
}: {
  tmdbId: number;
  titleName: string;
  seasons?: FrameXtvSeason[] | null;
  currentSeason?: number | null;
  currentEpisode?: number | null;
  onSelect: (season: number, episode: number) => void;
}) {
  const [seasons, setSeasons] = React.useState<FrameXtvSeason[] | null>(
    seasonsProp ? toFrameXtvSeasons(seasonsProp) : null,
  );
  const [seasonsError, setSeasonsError] = React.useState(false);
  const [activeSeason, setActiveSeason] = React.useState<number | null>(null);
  const [episodesBySeason, setEpisodesBySeason] = React.useState<
    Record<number, FrameXtvEpisode[]>
  >({});
  const [loadingSeason, setLoadingSeason] = React.useState<number | null>(null);
  const [failedSeason, setFailedSeason] = React.useState<number | null>(null);

  // Seasons passed from the server render win; otherwise fetch on open.
  React.useEffect(() => {
    if (seasonsProp) {
      setSeasons(toFrameXtvSeasons(seasonsProp));
      return;
    }
    let cancelled = false;
    fetch(`/api/tv/${tmdbId}/seasons`)
      .then((res) => {
        if (!res.ok) throw new Error(`seasons ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setSeasons(toFrameXtvSeasons(data.seasons));
      })
      .catch(() => {
        if (!cancelled) setSeasonsError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [seasonsProp, tmdbId]);

  // Default to the viewer's current season, else season 1.
  React.useEffect(() => {
    if (!seasons || seasons.length === 0 || activeSeason !== null) return;
    const resume = seasons.some((s) => s.season_number === currentSeason)
      ? (currentSeason as number)
      : (seasons[0]?.season_number ?? null);
    setActiveSeason(resume);
  }, [seasons, activeSeason, currentSeason]);

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
        setEpisodesBySeason((prev) => ({
          ...prev,
          [seasonNumber]: (data.episodes ?? []) as FrameXtvEpisode[],
        }));
      } catch {
        setFailedSeason(seasonNumber);
      } finally {
        setLoadingSeason((current) =>
          current === seasonNumber ? null : current,
        );
      }
    },
    [episodesBySeason, tmdbId],
  );

  React.useEffect(() => {
    if (activeSeason !== null && !episodesBySeason[activeSeason]) {
      void loadSeason(activeSeason);
    }
    // Only auto-load on season switch; loadSeason identity changes per cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSeason]);

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

  if (!seasons) {
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

  const episodes =
    activeSeason !== null ? (episodesBySeason[activeSeason] ?? null) : null;
  const showResume =
    currentSeason != null &&
    currentEpisode != null &&
    seasons.some((s) => s.season_number === currentSeason);

  return (
    <div className="min-h-0">
      {showResume && (
        <button
          type="button"
          onClick={() => onSelect(currentSeason, currentEpisode)}
          className="mb-3 flex w-full items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-left transition-colors hover:bg-primary/15"
        >
          <Play className="h-4 w-4 shrink-0 fill-current text-primary" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            Resume S{currentSeason} E{currentEpisode}
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
            {(episodes ?? []).map((episode) => {
              const runtime = formatRuntime(episode.runtime);
              return (
                <button
                  key={episode.episode_number}
                  type="button"
                  onClick={() => onSelect(activeSeason as number, episode.episode_number)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-border bg-card/50 p-2 text-left transition-colors hover:border-primary/40 hover:bg-card"
                >
                  {episode.still_path ? (
                    <Image
                      src={`${TMDB_IMG}/w185${episode.still_path}`}
                      alt=""
                      width={96}
                      height={54}
                      className="h-[54px] w-24 shrink-0 rounded-lg object-cover ring-1 ring-border/45"
                    />
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
                  <Play
                    aria-hidden
                    className="h-4 w-4 shrink-0 fill-current text-muted-foreground/55 transition-colors group-hover:text-primary"
                  />
                </button>
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
