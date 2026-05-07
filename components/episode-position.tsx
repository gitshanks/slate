import { EpisodePickerContent } from "@/components/episode-picker-content";

interface EpisodePositionProps {
  titleId: string;
  currentSeason: number | null;
  currentEpisode: number | null;
  seasons: { n: number; c: number }[];
}

function watchedCount(
  pos: { season: number | null; episode: number | null },
  seasons: { n: number; c: number }[],
): number {
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

  const totalEpisodes = seasons.reduce((a, s) => a + s.c, 0);
  const watched = watchedCount({ season: currentSeason, episode: currentEpisode }, seasons);
  const pct = totalEpisodes === 0 ? 0 : Math.round((watched / totalEpisodes) * 100);
  const started = currentSeason != null && currentEpisode != null;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="px-4 py-3">
        <EpisodePickerContent
          titleId={titleId}
          currentSeason={currentSeason}
          currentEpisode={currentEpisode}
          seasons={seasons}
        />

        {/* Slim overall-progress bar at the bottom of the picker. The
            position label and Mark-watched button used to sit above the
            picker; the +1 chip on poster cards covers advance everywhere
            else, and the picker itself shows where you are visually. */}
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
