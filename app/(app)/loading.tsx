import { Skeleton } from "@/components/ui/skeleton";

/** Four rail skeletons matching the live home layout. */
function RailSkeleton({ label }: { label: string }) {
  return (
    <section className="mt-14">
      <p className="mb-4 text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
        {label}
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

export default function HomeLoading() {
  return (
    <div>
      {/* Header skeleton */}
      <div className="mb-10">
        <Skeleton shape="text" className="h-3 w-24" />
        <Skeleton className="mt-3 h-10 w-40 rounded-md" />
      </div>

      {/* Filter bar skeleton */}
      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>

      <RailSkeleton label="Trending this week" />
      <RailSkeleton label="Popular films" />
      <RailSkeleton label="Now playing" />
      <RailSkeleton label="Popular TV shows" />
    </div>
  );
}
