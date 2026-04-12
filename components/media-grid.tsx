import { PosterCard } from "@/components/poster-card";
import type { TitleRow } from "@/lib/supabase";

interface MediaGridProps {
  titles: TitleRow[];
  /** Show sentiment icons instead of status chips on cards */
  showSentiment?: boolean;
}

export function MediaGrid({ titles, showSentiment }: MediaGridProps) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-10 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-6">
      {titles.map((t, i) => (
        <PosterCard key={t.id} title={t} priority={i < 8} showSentiment={showSentiment} />
      ))}
    </div>
  );
}
