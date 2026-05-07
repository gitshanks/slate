"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Play } from "lucide-react";
import { advanceEpisode } from "@/lib/actions";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
  // Two open-state pairs because the popover and the sheet are independent
  // Radix roots — only one is interactive at a given breakpoint, but both
  // close themselves on a successful pick.
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

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

  const pickerProps = {
    titleId,
    currentSeason,
    currentEpisode,
    seasons,
  };

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Position summary */}
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

        {/* Actions: left-aligned with the row on mobile (so they sit under
            the position label when the row wraps), pushed right on sm+. */}
        <div className="flex items-center gap-1.5 sm:ml-auto">
          {!finished && next && (
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
          )}

          {/* Desktop: popover anchored to the trigger */}
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="hidden h-8 items-center gap-1 rounded-full border border-border bg-background px-3 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:inline-flex"
                aria-label="Jump to a specific episode"
              >
                Jump to
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={8}
              className="w-[420px] max-w-[calc(100vw-2rem)] p-3"
            >
              <EpisodePickerContent
                {...pickerProps}
                onPicked={() => setPopoverOpen(false)}
              />
            </PopoverContent>
          </Popover>

          {/* Mobile: bottom sheet */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1 rounded-full border border-border bg-background px-3 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:hidden"
                aria-label="Jump to a specific episode"
              >
                Jump to
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              </button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="flex max-h-[88dvh] flex-col gap-0 rounded-t-2xl border-t p-0 pb-[max(env(safe-area-inset-bottom),1.25rem)]"
            >
              {/* Drag handle — purely visual, signals "this is a sheet". */}
              <div className="flex justify-center pt-2">
                <span
                  aria-hidden
                  className="h-1 w-9 rounded-full bg-foreground/20"
                />
              </div>

              {/* Header: title on the left, position context on the right.
                  Right-padded to clear the auto-rendered close button. */}
              <div className="flex items-baseline justify-between gap-3 px-5 pb-3 pr-12 pt-3">
                <SheetTitle className="text-base font-semibold tracking-tight">
                  Jump to episode
                </SheetTitle>
                {started && (
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                    {finished
                      ? `Finished · S${currentSeason}·E${currentEpisode}`
                      : `From S${currentSeason}·E${currentEpisode} · ${pct}%`}
                  </span>
                )}
              </div>

              <div className="border-t border-border/60" />

              {/* Picker — scrolls inside the sheet if a season has many
                  episodes, so the header and footer stay anchored. */}
              <div className="flex-1 overflow-y-auto px-5 pb-5 pt-4">
                <EpisodePickerContent
                  {...pickerProps}
                  onPicked={() => setSheetOpen(false)}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Slim progress bar */}
      {started && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-foreground/8">
          <div
            className="h-full bg-gradient-to-r from-primary to-fuchsia-400 transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
