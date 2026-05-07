"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCheck, ChevronDown } from "lucide-react";
import { setEpisodePosition } from "@/lib/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface EpisodePickerContentProps {
  titleId: string;
  currentSeason: number | null;
  currentEpisode: number | null;
  seasons: { n: number; c: number }[];
  // Called after a successful position change so the parent (popover/sheet)
  // can close itself. Optional — the picker still works without it.
  onPicked?: () => void;
}

// The "set my position" inner UI: a single header row (season dropdown +
// progress count + season-done button) followed by the episode grid. Lives
// inside a popover on desktop and a bottom sheet on mobile. Position-setting
// actions are in here; the compact row outside owns "advance one episode".
export function EpisodePickerContent({
  titleId,
  currentSeason,
  currentEpisode,
  seasons,
  onPicked,
}: EpisodePickerContentProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeSeason, setActiveSeason] = useState<number>(
    currentSeason ?? seasons[0]?.n ?? 1,
  );

  if (seasons.length === 0) return null;

  const active = seasons.find((s) => s.n === activeSeason) ?? seasons[0];
  const isSeasonDone =
    currentSeason != null &&
    currentEpisode != null &&
    (currentSeason > activeSeason ||
      (currentSeason === activeSeason && currentEpisode >= active.c));

  function watchedInSeason(s: { n: number; c: number }): number {
    if (currentSeason == null || currentEpisode == null) return 0;
    if (s.n < currentSeason) return s.c;
    if (s.n === currentSeason) return Math.min(currentEpisode, s.c);
    return 0;
  }

  function handlePick(season: number, episode: number) {
    startTransition(async () => {
      try {
        await setEpisodePosition(titleId, season, episode);
        router.refresh();
        onPicked?.();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <div
      className={cn("flex flex-col", pending && "pointer-events-none opacity-95")}
    >
      {/* Header row: season selector + count on the left, season-done on the
          right. Single row replaces the old strip + grid + footer-link
          arrangement; cuts ~50px of vertical space and surfaces the
          season-done action prominently. */}
      <div className="mb-3 flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5",
              "text-[12px] font-medium text-foreground transition-colors hover:bg-accent",
            )}
          >
            <span className="font-mono uppercase tracking-wider">
              Season {active.n}
            </span>
            {seasons.length > 1 && (
              <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
            )}
          </DropdownMenuTrigger>
          {seasons.length > 1 && (
            <DropdownMenuContent align="start" className="min-w-[12rem]">
              {seasons.map((s) => {
                const sw = watchedInSeason(s);
                const isCurrent = s.n === currentSeason;
                return (
                  <DropdownMenuItem
                    key={s.n}
                    onSelect={() => setActiveSeason(s.n)}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[12px]">
                        Season {s.n}
                      </span>
                      {isCurrent && (
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-primary"
                          aria-label="current season"
                        />
                      )}
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
                      {sw}/{s.c}
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          )}
        </DropdownMenu>

        <button
          type="button"
          disabled={pending || isSeasonDone}
          onClick={() => !isSeasonDone && handlePick(activeSeason, active.c)}
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-1 rounded-md border px-2.5 text-[11px] font-medium transition-colors",
            isSeasonDone
              ? "cursor-default border-primary/30 bg-primary/10 text-primary"
              : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:bg-accent hover:text-foreground",
          )}
          aria-label={
            isSeasonDone
              ? `Season ${activeSeason} already done`
              : `Mark all of season ${activeSeason} watched`
          }
        >
          {isSeasonDone ? (
            <>
              <CheckCheck className="h-3.5 w-3.5" aria-hidden />
              <span>Season done</span>
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5" aria-hidden />
              <span>Mark season done</span>
            </>
          )}
        </button>
      </div>

      {/* Episode grid for active season — 2.25rem min so cells stay
          finger-sized on mobile while still fitting ~9 columns at popover
          width on desktop. */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-1.5">
        {Array.from({ length: active.c }, (_, i) => {
          const ep = i + 1;
          const isWatched =
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
                "flex aspect-square items-center justify-center rounded-md border text-[11px] font-mono tabular-nums transition-colors",
                "disabled:cursor-not-allowed",
                isWatched
                  ? "border-primary/40 bg-primary/15 text-foreground hover:bg-primary/25"
                  : "border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                isCurrent && "!border-primary !bg-primary/30 text-foreground",
              )}
            >
              {ep}
            </button>
          );
        })}
      </div>
    </div>
  );
}
