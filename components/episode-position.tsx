import { EpisodePickerContent } from "@/components/episode-picker-content";

interface EpisodePositionProps {
  titleId: string;
  currentSeason: number | null;
  currentEpisode: number | null;
  seasons: { n: number; c: number }[];
}

export function EpisodePosition({
  titleId,
  currentSeason,
  currentEpisode,
  seasons,
}: EpisodePositionProps) {
  if (seasons.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="px-4 py-3">
        <EpisodePickerContent
          titleId={titleId}
          currentSeason={currentSeason}
          currentEpisode={currentEpisode}
          seasons={seasons}
        />
      </div>
    </div>
  );
}
