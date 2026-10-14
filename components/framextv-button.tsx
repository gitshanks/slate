"use client";

import * as React from "react";
import Image from "next/image";
import { ExternalLink, Play } from "lucide-react";
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
  frameXtvEpisodeUrl,
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

function trackOpen(
  source: string,
  type: "movie" | "tv",
  season?: number,
  episode?: number,
) {
  captureAnalytics("ui_interaction", {
    control: "framextv_open",
    source,
    media_type: type,
    season: season ?? null,
    episode: episode ?? null,
  });
}

/**
 * "Watch now" via frameXTV. Movies link straight to the player; TV shows
 * open a season/episode picker that deep-links per episode.
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

  if (type === "movie") {
    const href = frameXtvMovieUrl(tmdbId);
    if (variant === "row") {
      return (
        <ActionRow
          icon={<Play className="h-[18px] w-[18px] fill-current" />}
          label="Watch on frameXTV"
          sublabel="Stream now"
          onClick={() => {
            trackOpen(source, type);
            window.open(href, "_blank", "noopener,noreferrer");
          }}
        />
      );
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        data-analytics-action="watch_framextv"
        aria-label={`Watch ${titleName} on frameXTV`}
        title="Watch on frameXTV"
        onClick={() => trackOpen(source, type)}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-card/80"
      >
        <Play className="h-3.5 w-3.5 fill-current" />
        Watch now
      </a>
    );
  }

  const trigger =
    variant === "row" ? (
      <ActionRow
        icon={<Play className="h-[18px] w-[18px] fill-current" />}
        label="Watch on frameXTV"
        sublabel="Pick a season and episode"
        onClick={() => setOpen(true)}
      />
    ) : (
      <button
        type="button"
        data-analytics-action="watch_framextv"
        aria-label={`Watch ${titleName} on frameXTV`}
        title="Watch on frameXTV"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-card/80"
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
          size="md"
          className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-hidden rounded-2xl p-4"
        >
          <DialogTitle className="pr-6 text-sm font-semibold">
            Watch on frameXTV
          </DialogTitle>
          {open && (
            <FrameXtvEpisodePicker
              tmdbId={tmdbId}
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

function FrameXtvEpisodePicker({
  tmdbId,
  titleName,
  seasons: seasonsProp,
  currentSeason,
  currentEpisode,
  source,
}: {
  tmdbId: number;
  titleName: string;
  seasons?: FrameXtvSeason[] | null;
  currentSeason?: number | null;
  currentEpisode?: number | null;
  source: string;
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
          onClick={() => trackOpen(source, "tv")}
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
        <a
          href={frameXtvEpisodeUrl(tmdbId, currentSeason, currentEpisode)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackOpen(source, "tv", currentSeason, currentEpisode)}
          className="mb-3 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 transition-colors hover:bg-primary/15"
        >
          <Play className="h-4 w-4 shrink-0 fill-current text-primary" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            Resume S{currentSeason} E{currentEpisode}
          </span>
          <ExternalLink
            aria-hidden
            className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
          />
        </a>
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
                <a
                  key={episode.episode_number}
                  href={frameXtvEpisodeUrl(
                    tmdbId,
                    activeSeason as number,
                    episode.episode_number,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    trackOpen(source, "tv", activeSeason ?? undefined, episode.episode_number)
                  }
                  className="group flex items-center gap-3 rounded-xl border border-border bg-card/50 p-2 transition-colors hover:border-primary/40 hover:bg-card"
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
                  <ExternalLink
                    aria-hidden
                    className="h-3.5 w-3.5 shrink-0 text-muted-foreground/55 transition-colors group-hover:text-primary"
                  />
                </a>
              );
            })}
          </div>
        )}
      </div>

      <a
        href={frameXtvSeriesUrl(tmdbId)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackOpen(source, "tv")}
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        Open series page on frameXTV
        <ExternalLink className="h-3 w-3" aria-hidden />
      </a>
    </div>
  );
}
