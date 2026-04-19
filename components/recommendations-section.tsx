import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getRecommendedFromWatched } from "@/lib/tmdb";
import { RecommendationsExpandable } from "@/components/recommendations-expandable";

function RecommendationsSkeleton({ title }: { title: string }) {
  return (
    <section className="mt-14">
      <p className="mb-4 text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
        {title}
      </p>
      <div className="flex gap-3 overflow-hidden pb-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="w-[140px] shrink-0 sm:w-[160px]">
            <Skeleton className="aspect-[2/3] w-full rounded-xl" />
            <Skeleton shape="text" className="mt-2 h-3 w-4/5" />
            <Skeleton shape="text" className="mt-1.5 h-2.5 w-1/3" />
          </div>
        ))}
      </div>
    </section>
  );
}

async function RecommendationsLoader({
  title,
  savedTmdbIds,
}: {
  title: string;
  savedTmdbIds: Set<number>;
}) {
  const items = await getRecommendedFromWatched();
  return (
    <RecommendationsExpandable
      title={title}
      items={items}
      savedTmdbIds={Array.from(savedTmdbIds)}
    />
  );
}

/**
 * Server wrapper that fetches the watched-history-based recommendations
 * and hands them (preloaded) to the expandable client section. Matches
 * the Suspense + skeleton pattern of TmdbRailAsync.
 */
export function RecommendationsSection({
  title,
  savedTmdbIds,
}: {
  title: string;
  savedTmdbIds: Set<number>;
}) {
  return (
    <Suspense fallback={<RecommendationsSkeleton title={title} />}>
      <RecommendationsLoader title={title} savedTmdbIds={savedTmdbIds} />
    </Suspense>
  );
}
