import { Skeleton } from "@/components/ui/skeleton";

export default function WatchedLoading() {
  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <Skeleton shape="text" className="h-3 w-24" />
          <Skeleton className="mt-1 h-10 w-32 rounded-md" />
        </div>
      </div>

      {/* WatchedStats: 4 stat cards + 3 sentiment cards */}
      <section className="mb-10 space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[88px] rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[100px] rounded-2xl" />
          ))}
        </div>
      </section>

      {/* Filter bar */}
      <div className="mb-8 flex flex-wrap items-center gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-10 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-7 4xl:grid-cols-8 5xl:grid-cols-9 6xl:grid-cols-10">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="aspect-[2/3] w-full rounded-xl" />
            {/* PosterCard shows the title under the poster on mobile only. */}
            <Skeleton shape="text" className="mt-2 h-3 w-4/5 sm:hidden" />
            <Skeleton shape="text" className="mt-1.5 h-2.5 w-1/3 sm:hidden" />
          </div>
        ))}
      </div>
    </div>
  );
}
