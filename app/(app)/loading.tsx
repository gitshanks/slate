import { Skeleton } from "@/components/ui/skeleton";

/** Horizontal rail skeleton matching <TmdbRail> (semibold heading + tiles). */
function RailSkeleton({ className }: { className?: string }) {
  return (
    <section className={className ?? "mt-14"}>
      {/* h2 is text-lg sm:text-xl, not a mono eyebrow. */}
      <Skeleton className="mb-4 h-6 w-40 rounded-md" />
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

export default function HomeLoading() {
  return (
    <div>
      {/* Header — eyebrow + h1 "Up next" */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <Skeleton shape="text" className="h-3 w-24" />
          <Skeleton className="mt-1 h-10 w-40 rounded-md" />
        </div>
      </div>

      {/* Filter bar */}
      <div className="mb-8 flex flex-wrap items-center gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>

      {/* Watchlist grid — matches MediaGrid */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-10 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-7 4xl:grid-cols-8 5xl:grid-cols-9 6xl:grid-cols-10">
        {[
          "",
          "",
          "hidden sm:block",
          "hidden md:block",
          "hidden lg:block",
          "hidden 2xl:block",
          "hidden 3xl:block",
          "hidden 4xl:block",
          "hidden 5xl:block",
          "hidden 6xl:block",
        ].map((visibility, i) => (
          <div key={i} className={visibility}>
            <Skeleton className="aspect-[2/3] w-full rounded-xl" />
            {/* Title under poster shows on mobile only. */}
            <Skeleton shape="text" className="mt-2 h-3 w-4/5 sm:hidden" />
            <Skeleton shape="text" className="mt-1.5 h-2.5 w-1/3 sm:hidden" />
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-3 sm:mt-8">
        <span className="h-px flex-1 bg-border/70" />
        <Skeleton className="h-11 w-40 rounded-full" />
        <span className="h-px flex-1 bg-border/70" />
      </div>

      {/* Discover section — the rails live under this header on the real page. */}
      <div className="mt-12 border-t border-border/60 pt-10 sm:mt-16 sm:pt-12">
        <Skeleton shape="text" className="h-3 w-20" />
        <Skeleton className="mt-1 h-8 w-56 rounded-md" />
        <RailSkeleton className="mt-6" />
        <RailSkeleton />
        <RailSkeleton />
      </div>
    </div>
  );
}
