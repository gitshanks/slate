"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Play } from "lucide-react";
import { advanceEpisode } from "@/lib/actions";
import { EpisodePickerContent } from "@/components/episode-picker-content";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface EpisodePositionProps {
  titleId: string;
  currentSeason: number | null;
  currentEpisode: number | null;
  seasons: { n: number; c: number }[];
}

type Position = { season: number | null; episode: number | null };

function nextEpisode(
  pos: Position,
  seasons: { n: number; c: number }[],
): { season: number; episode: number } | null {
  if (seasons.length === 0) return null;
  if (pos.season == null || pos.episode == null) {
    return { season: seasons[0].n, episode: 1 };
  }
  const current = seasons.find((s) => s.n === pos.season);
  if (!current) return { season: seasons[0].n, episode: 1 };
  if (pos.episode < current.c) return { season: pos.season, episode: pos.episode + 1 };
  const idx = seasons.indexOf(current);
  const next = seasons[idx + 1];
  if (next) return { season: next.n, episode: 1 };
  return null;
}

function watchedCount(pos: Position, seasons: { n: number; c: number }[]): number {
  if (pos.season == null || pos.episode == null) return 0;
  let count = 0;
  for (const s of seasons) {
    if (s.n < pos.season) count += s.c;
    else if (s.n === pos.season) count += Math.min(pos.episode, s.c);
  }
  return count;
}

export function EpisodePosition({
  titleId,
  currentSeason,
  currentEpisode,
  seasons,
}: EpisodePositionProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (seasons.length === 0) return null;

  const pos: Position = { season: currentSeason, episode: currentEpisode };
  const totalEpisodes = seasons.reduce((a, s) => a + s.c, 0);
  const watched = watchedCount(pos, seasons);
  const pct = totalEpisodes === 0 ? 0 : Math.round((watched / totalEpisodes) * 100);
  const next = nextEpisode(pos, seasons);
  const started = currentSeason != null && currentEpisode != null;
  const finished = started && !next;

  function handleAdvance() {
    startTransition(async () => {
      try {
        await advanceEpisode(titleId);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  const positionLabel = finished
    ? `S${currentSeason}·E${currentEpisode}`
    : started && next
      ? `S${next.season}·E${next.episode}`
      : "Not started";

  const eyebrow = finished ? "Finished" : started ? "Up next" : "Ready to start";

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Position summary + advance action + slim progress bar */}
      <div className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-mono">
              {eyebrow}
            </span>
            <span className="font-mono text-base font-semibold tabular-nums text-foreground">
              {positionLabel}
            </span>
            {started && (
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                · {pct}%
              </span>
            )}
          </div>

          {!finished && next && (
            <div className="flex items-center gap-1.5 sm:ml-auto">
              <button
                type="button"
                onClick={handleAdvance}
                disabled={pending}
                className={cn(
                  "inline-flex h-8 items-center gap-1 rounded-full bg-foreground px-3 text-xs font-medium text-background transition-opacity",
                  "hover:opacity-90 disabled:opacity-60",
                )}
              >
                {started ? (
                  <>
                    <Check className="h-3.5 w-3.5" aria-hidden />
                    Mark watched
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
                    Start
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {started && (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-foreground/8">
            <div
              className="h-full bg-gradient-to-r from-primary to-fuchsia-400 transition-[width] duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>

      {/* Inline picker — used to live behind a 'Jump to' popover/sheet, now
          on the page so jumping to a specific episode is a single tap. */}
      <div className="border-t border-border/70 bg-background/40 px-4 py-3">
        <EpisodePickerContent
          titleId={titleId}
          currentSeason={currentSeason}
          currentEpisode={currentEpisode}
          seasons={seasons}
        />
      </div>
    </div>
  );
}
