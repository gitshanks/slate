import { PosterCard } from "@/components/poster-card";
import { MotionGrid, MotionItem } from "@/components/motion-grid";
import type { TitleRow } from "@/lib/supabase";

interface MediaGridProps {
  titles: TitleRow[];
}

export function MediaGrid({ titles }: MediaGridProps) {
  return (
    <MotionGrid className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-10 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-7 4xl:grid-cols-8 5xl:grid-cols-9 6xl:grid-cols-10">
      {titles.map((t, i) => (
        // Keyed per title so only newly-mounted cards animate — filter/sort
        // changes reconcile in place instead of re-staggering the whole grid.
        <MotionItem key={t.id}>
          <PosterCard title={t} priority={i < 8} />
        </MotionItem>
      ))}
    </MotionGrid>
  );
}
