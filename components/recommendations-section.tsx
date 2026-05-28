import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getRecommendedFromWatched } from "@/lib/tmdb";
import { RecommendationsExpandable } from "@/components/recommendations-expandable";

function RecommendationsSkeleton({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <section className="mt-14">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
        {title}
      </p>
      {subtitle && (
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      )}
      <div className="mt-4 flex gap-3 overflow-hidden pb-2">
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
  subtitle,
  savedTmdbIds,
  preview,
}: {
  title: string;
  subtitle?: string;
  savedTmdbIds: Set<number>;
  preview?: boolean;
}) {
  const items = await getRecommendedFromWatched();
  return (
    <RecommendationsExpandable
      title={title}
      subtitle={subtitle}
      items={items}
      savedTmdbIds={Array.from(savedTmdbIds)}
      preview={preview}
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
  subtitle,
  savedTmdbIds,
  preview,
}: {
  title: string;
  subtitle?: string;
  savedTmdbIds: Set<number>;
  preview?: boolean;
}) {
  return (
    <Suspense fallback={<RecommendationsSkeleton title={title} subtitle={subtitle} />}>
      <RecommendationsLoader
        title={title}
        subtitle={subtitle}
        savedTmdbIds={savedTmdbIds}
        preview={preview}
      />
    </Suspense>
  );
}
