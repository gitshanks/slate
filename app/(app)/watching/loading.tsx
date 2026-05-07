import { Skeleton } from "@/components/ui/skeleton";

/** Reusable poster-grid skeleton tuned to match MediaGrid's columns. */
function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-10 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <Skeleton className="aspect-[2/3] w-full rounded-xl" />
          <Skeleton shape="text" className="mt-2 h-3 w-4/5" />
          <Skeleton shape="text" className="mt-1.5 h-2.5 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export default function WatchingLoading() {
  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <Skeleton shape="text" className="h-3 w-24" />
          <Skeleton className="mt-3 h-9 w-44 rounded-md" />
        </div>
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>

      <GridSkeleton />
    </div>
  );
}
