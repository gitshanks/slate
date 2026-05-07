"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Check, CheckCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setEpisodePosition } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SeasonEpisodePickerProps {
  titleId: string;
  currentSeason: number | null;
  currentEpisode: number | null;
  seasons: { n: number; c: number }[];
}

export function SeasonEpisodePicker({
  titleId,
  currentSeason,
  currentEpisode,
  seasons,
}: SeasonEpisodePickerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeSeason, setActiveSeason] = useState<number>(
    currentSeason ?? seasons[0]?.n ?? 1,
  );

  if (seasons.length === 0) return null;

  const active = seasons.find((s) => s.n === activeSeason) ?? seasons[0];

  // Overall progress
  const totalEpisodes = seasons.reduce((sum, s) => sum + s.c, 0);
  const watchedEpisodes =
    currentSeason == null || currentEpisode == null
      ? 0
      : seasons.filter((s) => s.n < currentSeason).reduce((sum, s) => sum + s.c, 0) +
        currentEpisode;
  const progressPct = totalEpisodes > 0 ? (watchedEpisodes / totalEpisodes) * 100 : 0;

  const positionLabel =
    currentSeason != null && currentEpisode != null
      ? `S${currentSeason}·E${currentEpisode}`
      : null;

  // Is the currently-viewed season fully watched?
  const isSeasonDone =
    currentSeason != null &&
    currentEpisode != null &&
    (currentSeason > activeSeason ||
      (currentSeason === activeSeason && currentEpisode >= active.c));

  // Inline tabs for ≤6 seasons; dropdown for 7+
  const useTabs = seasons.length <= 6;

  function handlePick(season: number, episode: number) {
    startTransition(async () => {
      try {
        await setEpisodePosition(titleId, season, episode);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      {/* Header: progress summary + season navigation */}
      <div className="flex items-start justify-between gap-4">
        {/* Progress summary */}
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
              {watchedEpisodes}
            </span>
            <span className="font-mono text-sm text-muted-foreground tabular-nums">
              / {totalEpisodes}
            </span>
            <span className="text-xs text-muted-foreground">episodes</span>
          </div>
          {positionLabel ? (
            <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
              up to {positionLabel}
            </p>
          ) : (
            <p className="mt-0.5 text-[11px] text-muted-foreground">not started</p>
          )}
        </div>

        {/* Season navigation */}
        {useTabs ? (
          <div className="flex flex-wrap justify-end gap-1">
            {seasons.map((s) => (
              <button
                key={s.n}
                type="button"
                onClick={() => setActiveSeason(s.n)}
                className={cn(
                  "h-7 min-w-[2rem] rounded-md px-2 text-xs font-mono transition-colors",
                  s.n === activeSeason
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                S{s.n}
              </button>
            ))}
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Season {active.n}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-32">
              {seasons.map((s) => (
                <DropdownMenuItem
                  key={s.n}
                  onSelect={() => setActiveSeason(s.n)}
                  className="flex items-center justify-between gap-3"
                >
                  <span>Season {s.n}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {s.c} ep
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Overall progress bar */}
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-primary/60 transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Episode grid */}
      <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-1.5">
        {Array.from({ length: active.c }, (_, i) => {
          const ep = i + 1;
          const watched =
            currentSeason != null &&
            currentEpisode != null &&
            (active.n < currentSeason ||
              (active.n === currentSeason && ep <= currentEpisode));
          const isCurrent = active.n === currentSeason && ep === currentEpisode;

          return (
            <button
              key={ep}
              type="button"
              disabled={pending}
              onClick={() => handlePick(active.n, ep)}
              aria-label={`Mark watched up to season ${active.n} episode ${ep}`}
              className={cn(
                "relative flex h-10 items-center justify-center rounded-md border text-xs font-mono tabular-nums transition-all",
                "disabled:cursor-not-allowed",
                watched
                  ? "border-primary/40 bg-primary/15 text-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                isCurrent && "ring-2 ring-primary ring-offset-1 ring-offset-card",
              )}
            >
              {ep}
              {isCurrent && (
                <Check
                  className="absolute right-0.5 top-0.5 h-2.5 w-2.5 text-primary"
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Mark season done shortcut */}
      <div className="mt-3 flex items-center justify-end">
        <button
          type="button"
          disabled={pending || isSeasonDone}
          onClick={() => !isSeasonDone && handlePick(activeSeason, active.c)}
          className={cn(
            "inline-flex items-center gap-1.5 text-[11px] transition-colors",
            isSeasonDone
              ? "cursor-default text-primary/60"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {isSeasonDone ? (
            <>
              <CheckCheck className="h-3.5 w-3.5" aria-hidden />
              Season {activeSeason} complete
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5" aria-hidden />
              Mark season {activeSeason} watched
            </>
          )}
        </button>
      </div>
    </div>
  );
}
