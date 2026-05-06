"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Check } from "lucide-react";
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
  // Tab defaults to the season the user is on, else the first season.
  const [activeSeason, setActiveSeason] = useState<number>(
    currentSeason ?? seasons[0]?.n ?? 1,
  );

  if (seasons.length === 0) return null;

  const active = seasons.find((s) => s.n === activeSeason) ?? seasons[0];
  const positionLabel =
    currentSeason != null && currentEpisode != null
      ? `S${currentSeason}·E${currentEpisode}`
      : "Not started";

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
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Watched up to</span>
          <span className="font-mono font-medium tabular-nums text-foreground">
            {positionLabel}
          </span>
        </div>
        {seasons.length > 1 ? (
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
        ) : (
          <span className="text-xs text-muted-foreground font-mono">
            {active.c} episodes
          </span>
        )}
      </div>

      {/* Episode grid: tap an episode to mark it as the latest one watched. */}
      <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-1.5">
        {Array.from({ length: active.c }, (_, i) => {
          const ep = i + 1;
          const watched =
            currentSeason != null &&
            currentEpisode != null &&
            (active.n < currentSeason ||
              (active.n === currentSeason && ep <= currentEpisode));
          const isCurrent =
            active.n === currentSeason && ep === currentEpisode;

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

      <p className="mt-3 text-[11px] text-muted-foreground">
        Tap an episode to set it as the last one you watched.
      </p>
    </div>
  );
}
