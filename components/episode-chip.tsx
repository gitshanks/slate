"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Play } from "lucide-react";
import { advanceEpisode } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface EpisodeChipProps {
  titleId: string;
  currentSeason: number | null;
  currentEpisode: number | null;
  // [{n: 1, c: 10}, {n: 2, c: 9}, ...] — null/empty means we don't have
  // season metadata for this title (old rows pre-migration), so we hide
  // the chip rather than guess.
  seasons: { n: number; c: number }[] | null;
}

type Position = { season: number | null; episode: number | null };

function predictNext(pos: Position, seasons: { n: number; c: number }[]): Position {
  if (seasons.length === 0) return pos;
  if (pos.season == null || pos.episode == null) {
    return { season: seasons[0].n, episode: 1 };
  }
  const current = seasons.find((s) => s.n === pos.season);
  if (!current) return { season: seasons[0].n, episode: 1 };
  if (pos.episode < current.c) {
    return { season: pos.season, episode: pos.episode + 1 };
  }
  const idx = seasons.indexOf(current);
  const next = seasons[idx + 1];
  if (next) return { season: next.n, episode: 1 };
  // Already on the last episode of the last season; server will flip status.
  return pos;
}

// Linear progress through the whole show: episodes-watched / total-episodes.
// Returns 0..1.
function progressFraction(
  pos: Position,
  seasons: { n: number; c: number }[],
): number {
  const total = seasons.reduce((a, s) => a + s.c, 0);
  if (total === 0) return 0;
  if (pos.season == null || pos.episode == null) return 0;
  let watched = 0;
  for (const s of seasons) {
    if (s.n < pos.season) {
      watched += s.c;
    } else if (s.n === pos.season) {
      watched += Math.min(pos.episode, s.c);
      break;
    }
  }
  return Math.max(0, Math.min(1, watched / total));
}

export function EpisodeChip({
  titleId,
  currentSeason,
  currentEpisode,
  seasons,
}: EpisodeChipProps) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic<Position, Position>(
    { season: currentSeason, episode: currentEpisode },
    (_, next) => next,
  );
  const router = useRouter();

  if (!seasons || seasons.length === 0) return null;

  const started = optimistic.season != null && optimistic.episode != null;
  const label = started ? `S${optimistic.season}·E${optimistic.episode}` : "Start";
  const fraction = progressFraction(optimistic, seasons);
  const pct = `${Math.round(fraction * 100)}%`;

  function handleAdvance(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    startTransition(async () => {
      setOptimistic(predictNext(optimistic, seasons!));
      try {
        await advanceEpisode(titleId);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to advance");
      }
    });
  }

  return (
    <button
      type="button"
      aria-label={`Advance episode (currently ${label})`}
      onClick={handleAdvance}
      className={cn(
        "group/chip absolute right-2 top-2 z-20 inline-flex items-center gap-1 overflow-hidden rounded-full",
        "bg-black/55 backdrop-blur-md px-2.5 py-1 text-[11px] font-medium text-white",
        "ring-1 ring-white/15 shadow-lg shadow-black/20 transition-all",
        "hover:bg-black/70 hover:ring-primary/50 hover:-translate-y-px",
        "active:scale-95",
        pending && "opacity-80",
      )}
    >
      {/* Progress fill — sits underneath the label, anchored to the left edge.
          Subtle primary tint so the chip itself reads as a progress indicator. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 -z-0 bg-gradient-to-r from-primary/55 to-primary/25 transition-[width] duration-300 ease-out"
        style={{ width: pct }}
      />
      {started ? (
        <>
          <span className="relative z-10 font-mono tabular-nums">{label}</span>
          <ChevronRight
            className="relative z-10 h-3 w-3 opacity-90 transition-transform duration-200 group-hover/chip:translate-x-0.5"
            aria-hidden
          />
        </>
      ) : (
        <>
          <Play className="relative z-10 h-3 w-3 fill-current" aria-hidden />
          <span className="relative z-10">Start</span>
        </>
      )}
    </button>
  );
}
