"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCheck, ChevronRight, Play } from "lucide-react";
import { advanceEpisode, setEpisodePosition } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SeasonEpisodePickerProps {
  titleId: string;
  currentSeason: number | null;
  currentEpisode: number | null;
  seasons: { n: number; c: number }[];
}

type Position = { season: number | null; episode: number | null };

// Number of episodes the user has finished, given their current position.
function watchedCount(pos: Position, seasons: { n: number; c: number }[]): number {
  if (pos.season == null || pos.episode == null) return 0;
  let count = 0;
  for (const s of seasons) {
    if (s.n < pos.season) count += s.c;
    else if (s.n === pos.season) count += Math.min(pos.episode, s.c);
  }
  return count;
}

// What's "up next" — the first unwatched episode after the current position.
// Returns null if the user has finished the show.
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
  if (pos.episode < current.c) {
    return { season: pos.season, episode: pos.episode + 1 };
  }
  const idx = seasons.indexOf(current);
  const next = seasons[idx + 1];
  if (next) return { season: next.n, episode: 1 };
  return null; // finished
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

  const pos: Position = { season: currentSeason, episode: currentEpisode };
  const totalEpisodes = seasons.reduce((a, s) => a + s.c, 0);
  const watched = watchedCount(pos, seasons);
  const overallPct = totalEpisodes === 0 ? 0 : (watched / totalEpisodes) * 100;
  const next = nextEpisode(pos, seasons);
  const started = currentSeason != null && currentEpisode != null;
  const finished = started && !next;
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
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card shadow-sm",
        pending && "pointer-events-none opacity-95",
      )}
    >
      {/* ── Hero: up next + primary CTA + overall progress ─────────────── */}
      <div className="relative overflow-hidden p-5 sm:p-6">
        {/* Soft tint behind the hero, fades on the right */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-0 bg-gradient-to-br from-primary/12 via-primary/5 to-transparent"
        />

        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-mono">
              {finished ? "Finished" : started ? "Up next" : "Ready to start"}
            </p>
            <p className="mt-2 flex items-baseline gap-2 font-mono">
              <span className="text-3xl font-semibold tracking-tight tabular-nums text-foreground sm:text-4xl">
                {finished
                  ? `S${currentSeason}·E${currentEpisode}`
                  : next
                    ? `S${next.season}·E${next.episode}`
                    : "—"}
              </span>
              {started && !finished && (
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  next
                </span>
              )}
            </p>
          </div>

          {!finished && next && (
            <button
              type="button"
              onClick={handleAdvance}
              disabled={pending}
              className={cn(
                "group inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-foreground px-4 text-sm font-medium text-background",
                "shadow-lg shadow-primary/10 transition-all",
                "hover:-translate-y-px hover:shadow-xl hover:shadow-primary/20",
                "active:scale-95 disabled:opacity-60",
              )}
            >
              {started ? (
                <>
                  <Check className="h-4 w-4" aria-hidden />
                  Mark watched
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-current" aria-hidden />
                  Start watching
                </>
              )}
              <ChevronRight
                className="h-3.5 w-3.5 opacity-70 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </button>
          )}
        </div>

        {/* Overall progress bar */}
        <div className="relative mt-5">
          <div className="h-1.5 overflow-hidden rounded-full bg-foreground/8 ring-1 ring-foreground/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-fuchsia-400 transition-[width] duration-500 ease-out"
              style={{ width: `${overallPct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
            <span className="tabular-nums text-foreground/80">
              {watched.toLocaleString()} / {totalEpisodes.toLocaleString()}
            </span>
            <span className="tabular-nums">{Math.round(overallPct)}%</span>
          </div>
        </div>
      </div>

      {/* ── Season strip: tabs with mini progress fills ─────────────────── */}
      <div className="border-t border-border/70 bg-background/40">
        <div className="flex gap-1.5 overflow-x-auto px-3 py-3 sm:px-5 [scrollbar-width:thin]">
          {seasons.map((s) => {
            const isActive = s.n === activeSeason;
            const isCurrent = s.n === currentSeason;
            const sw = watchedInSeason(s);
            const sPct = s.c === 0 ? 0 : (sw / s.c) * 100;

            return (
              <button
                key={s.n}
                type="button"
                onClick={() => setActiveSeason(s.n)}
                className={cn(
                  "group/season relative shrink-0 rounded-lg border px-3 py-2 text-left transition-all",
                  isActive
                    ? "border-foreground/20 bg-card shadow-sm"
                    : "border-transparent bg-transparent hover:bg-foreground/[0.04]",
                )}
                aria-current={isActive ? "true" : undefined}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-[11px] font-mono uppercase tracking-wider",
                      isActive ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    Season {s.n}
                  </span>
                  {isCurrent && (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary))]" />
                  )}
                </div>
                <p
                  className={cn(
                    "mt-0.5 text-[10px] font-mono tabular-nums",
                    isActive ? "text-foreground/70" : "text-muted-foreground/80",
                  )}
                >
                  {sw} / {s.c}
                </p>
                {/* Mini progress underline */}
                <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-foreground/10">
                  <div
                    className={cn(
                      "h-full transition-[width] duration-300",
                      isActive
                        ? "bg-primary"
                        : "bg-foreground/30 group-hover/season:bg-foreground/50",
                    )}
                    style={{ width: `${sPct}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Episode grid for the active season ──────────────────────────── */}
      <div className="px-4 pb-5 pt-4 sm:px-6 sm:pb-6">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-1.5">
          {Array.from({ length: active.c }, (_, i) => {
            const ep = i + 1;
            const isWatched =
              currentSeason != null &&
              currentEpisode != null &&
              (active.n < currentSeason ||
                (active.n === currentSeason && ep <= currentEpisode));
            const isCurrent = active.n === currentSeason && ep === currentEpisode;
            const isNext =
              !finished &&
              next != null &&
              active.n === next.season &&
              ep === next.episode;

            return (
              <button
                key={ep}
                type="button"
                disabled={pending}
                onClick={() => handlePick(active.n, ep)}
                aria-label={`Mark watched up to season ${active.n} episode ${ep}`}
                className={cn(
                  "group/ep relative flex aspect-square items-center justify-center rounded-md border text-[11px] font-mono tabular-nums transition-all",
                  "disabled:cursor-not-allowed",
                  isWatched
                    ? "border-primary/40 bg-primary/15 text-foreground hover:bg-primary/25"
                    : "border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                  isCurrent &&
                    "!border-primary !bg-primary/30 text-foreground shadow-[0_0_0_2px_hsl(var(--primary)/0.25)]",
                  isNext &&
                    !isCurrent &&
                    "border-primary/40 ring-2 ring-primary/30 ring-offset-1 ring-offset-card",
                )}
              >
                {ep}
                {isCurrent && (
                  <span
                    aria-hidden
                    className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary))]"
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            Tap any episode to set it as the last one you watched.
            {!finished && next && (
              <>
                {" "}
                Highlighted episode is{" "}
                <span className="font-medium text-foreground">up next</span>.
              </>
            )}
          </p>
          <button
            type="button"
            disabled={pending || isSeasonDone}
            onClick={() => !isSeasonDone && handlePick(activeSeason, active.c)}
            className={cn(
              "ml-4 inline-flex shrink-0 items-center gap-1 text-[11px] transition-colors",
              isSeasonDone
                ? "cursor-default text-primary/60"
                : "text-muted-foreground hover:text-foreground",
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
      </div>
    </div>
  );
}
