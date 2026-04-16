import { Suspense } from "react";
import { TmdbRail } from "@/components/tmdb-rail";
import { Skeleton } from "@/components/ui/skeleton";
import type { TmdbSearchResult } from "@/lib/tmdb";

function RailSkeleton({ title }: { title: string }) {
  return (
    <section className="mt-14">
      <p className="mb-4 text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
        {title}
      </p>
      <div className="-mr-4 sm:-mr-6 lg:-mr-10">
        <div className="flex gap-3 overflow-hidden pb-2 pr-4 sm:pr-6 lg:pr-10">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="w-[140px] shrink-0 sm:w-[160px]">
              <Skeleton className="aspect-[2/3] w-full rounded-xl" />
              <Skeleton shape="text" className="mt-2 h-3 w-4/5" />
              <Skeleton shape="text" className="mt-1.5 h-2.5 w-1/3" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

interface TmdbRailAsyncProps {
  title: string;
  fetcher: () => Promise<TmdbSearchResult[]>;
  savedTmdbIds?: Set<number>;
}

async function TmdbRailLoader({ title, fetcher, savedTmdbIds }: TmdbRailAsyncProps) {
  const items = await fetcher();
  return <TmdbRail title={title} items={items} savedTmdbIds={savedTmdbIds} />;
}

export function TmdbRailAsync(props: TmdbRailAsyncProps) {
  return (
    <Suspense fallback={<RailSkeleton title={props.title} />}>
      <TmdbRailLoader {...props} />
    </Suspense>
  );
}
