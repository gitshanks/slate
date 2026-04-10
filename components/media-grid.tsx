import { PosterCard } from "@/components/poster-card";
import type { TitleRow } from "@/lib/supabase";

export function MediaGrid({ titles }: { titles: TitleRow[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {titles.map((t, i) => (
        <PosterCard key={t.id} title={t} index={i} priority={i < 6} />
      ))}
    </div>
  );
}
