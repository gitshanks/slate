"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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

  const currentSeasonData = seasons.find((s) => s.n === optimistic.season);

  const label =
    optimistic.season != null && optimistic.episode != null
      ? currentSeasonData != null
        ? `S${optimistic.season}·E${optimistic.episode}/${currentSeasonData.c}`
        : `S${optimistic.season}·E${optimistic.episode}`
      : "Start";

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
        "absolute right-2 top-2 z-20 inline-flex items-center gap-1 rounded-full",
        "bg-black/70 backdrop-blur-sm px-2 py-1 text-[11px] font-medium text-white",
        "ring-1 ring-white/10 transition-all",
        "hover:bg-black/85 hover:ring-white/25 active:scale-95",
        pending && "opacity-70",
      )}
    >
      <span className="font-mono tabular-nums">{label}</span>
      <Plus className="h-3 w-3 opacity-80" />
    </button>
  );
}
