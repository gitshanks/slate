import { EpisodePickerContent } from "@/components/episode-picker-content";

interface EpisodePositionProps {
  titleId: string;
  currentSeason: number | null;
  currentEpisode: number | null;
  seasons: { n: number; c: number }[];
}

type Pos = { season: number | null; episode: number | null };

function nextEpisode(
  pos: Pos,
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
  const upcoming = seasons[idx + 1];
  if (upcoming) return { season: upcoming.n, episode: 1 };
  return null;
}

function watchedCount(pos: Pos, seasons: { n: number; c: number }[]): number {
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
  if (seasons.length === 0) return null;

  const pos: Pos = { season: currentSeason, episode: currentEpisode };
  const totalEpisodes = seasons.reduce((a, s) => a + s.c, 0);
  const watched = watchedCount(pos, seasons);
  const pct = totalEpisodes === 0 ? 0 : Math.round((watched / totalEpisodes) * 100);
  const next = nextEpisode(pos, seasons);
  const started = currentSeason != null && currentEpisode != null;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="px-4 py-3">
        {/* Top-right "Up next" pin — tiny, sits above the picker so it
            doesn't compete with the season dropdown / Mark-season-done
            controls. Keeps the user oriented without re-introducing the
            heavier summary block we just removed. */}
        {next && (
          <div className="mb-2 flex justify-end">
            <span className="font-mono text-[11px]">
              <span className="uppercase tracking-[0.18em] text-muted-foreground">
                Up next
              </span>
              <span className="ml-1.5 tabular-nums text-foreground">
                S{next.season}·E{next.episode}
              </span>
            </span>
          </div>
        )}

        <EpisodePickerContent
          titleId={titleId}
          currentSeason={currentSeason}
          currentEpisode={currentEpisode}
          seasons={seasons}
        />

        {started && (
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-foreground/8">
            <div
              className="h-full bg-gradient-to-r from-primary to-fuchsia-400 transition-[width] duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
