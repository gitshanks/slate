"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCheck } from "lucide-react";
import { setEpisodePosition } from "@/lib/actions";
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

// The "set my position" inner UI: season strip + episode grid + a season-done
// shortcut. Lives inside a popover on desktop and a bottom sheet on mobile.
// All the position-setting actions are in here; the compact row outside owns
// the "advance one episode" CTA.
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
      {/* Season strip */}
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-4 [scrollbar-width:thin]">
        {seasons.map((s) => {
          const isActive = s.n === activeSeason;
          const isCurrent = s.n === currentSeason;
          return (
            <button
              key={s.n}
              type="button"
              onClick={() => setActiveSeason(s.n)}
              className={cn(
                "shrink-0 rounded-md border px-2.5 py-1 text-left transition-colors",
                isActive
                  ? "border-foreground/20 bg-card"
                  : "border-transparent bg-transparent hover:bg-foreground/[0.04]",
              )}
              aria-current={isActive ? "true" : undefined}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "text-[11px] font-mono uppercase tracking-wider",
                    isActive ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  S{s.n}
                </span>
                {isCurrent && (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                )}
                <span
                  className={cn(
                    "text-[10px] font-mono tabular-nums",
                    isActive ? "text-foreground/70" : "text-muted-foreground/70",
                  )}
                >
                  {watchedInSeason(s)}/{s.c}
                </span>
              </div>
            </button>
          );
        })}
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

      {/* Season-done shortcut */}
      <button
        type="button"
        disabled={pending || isSeasonDone}
        onClick={() => !isSeasonDone && handlePick(activeSeason, active.c)}
        className={cn(
          "mt-4 inline-flex items-center justify-center gap-1.5 self-start rounded-md px-2 py-1 text-[11px] transition-colors",
          isSeasonDone
            ? "cursor-default text-primary/70"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        {isSeasonDone ? (
          <>
            <CheckCheck className="h-3.5 w-3.5" aria-hidden />
            Season {activeSeason} done
          </>
        ) : (
          <>
            <Check className="h-3.5 w-3.5" aria-hidden />
            Mark season {activeSeason} watched
          </>
        )}
      </button>
    </div>
  );
}
