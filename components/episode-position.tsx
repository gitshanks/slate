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

export function EpisodePosition({
  titleId,
  currentSeason,
  currentEpisode,
  seasons,
}: EpisodePositionProps) {
  if (seasons.length === 0) return null;

  const next = nextEpisode(
    { season: currentSeason, episode: currentEpisode },
    seasons,
  );

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="px-4 py-3">
        <EpisodePickerContent
          titleId={titleId}
          currentSeason={currentSeason}
          currentEpisode={currentEpisode}
          seasons={seasons}
          // Slots in beside the Season dropdown + Mark-season-done button,
          // pushed to the right end of the same row so we don't spawn a
          // second header.
          headerRight={
            next ? (
              <span className="font-mono text-[11px]">
                <span className="uppercase tracking-[0.18em] text-muted-foreground">
                  Up next
                </span>
                <span className="ml-1.5 tabular-nums text-foreground">
                  S{next.season}·E{next.episode}
                </span>
              </span>
            ) : null
          }
        />
      </div>
    </div>
  );
}
