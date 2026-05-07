import { Skeleton } from "@/components/ui/skeleton";

/**
 * /discover/[type]/[tmdbId] is the TMDB-detail view for titles not yet in
 * the library — same shape as /title/[id] (backdrop hero + poster column +
 * cast/recs rails) but driven by a TMDB lookup, not Supabase. The skeleton
 * mirrors that layout so the watchlist-rails fallback doesn't flash.
 */
export default function DiscoverTitleLoading() {
  return (
    <div className="-mx-4 -my-8 sm:-mx-6 sm:-my-10 lg:-mx-10 lg:-my-14 pb-20">
      <div className="relative h-[60vh] min-h-[420px] w-full overflow-hidden">
        <Skeleton className="absolute inset-0 rounded-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      </div>

      <div className="relative -mt-44 px-4 sm:-mt-48 sm:px-6 lg:px-10">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-[240px_1fr] md:gap-12">
          <div className="hidden md:block">
            <Skeleton className="aspect-[2/3] w-full rounded-2xl" />
            <Skeleton className="mt-4 h-14 w-full rounded-xl" />
          </div>

          <div>
            <Skeleton shape="text" className="h-3 w-32" />
            <Skeleton className="mt-3 h-12 w-4/5 max-w-xl rounded-md" />
            <Skeleton shape="text" className="mt-3 h-4 w-1/2 max-w-sm" />

            <div className="mt-4 flex gap-1.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-16 rounded-full" />
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Skeleton className="h-9 w-40 rounded-full" />
              <Skeleton className="h-9 w-24 rounded-full" />
            </div>

            <div className="mt-6 max-w-2xl space-y-2">
              <Skeleton shape="text" />
              <Skeleton shape="text" />
              <Skeleton shape="text" className="w-4/5" />
            </div>

            <section className="mt-14">
              <Skeleton shape="text" className="h-3 w-48" />
              <div className="mt-4 flex gap-3 overflow-hidden pb-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="w-[140px] shrink-0 sm:w-[160px]">
                    <Skeleton className="aspect-[2/3] w-full rounded-xl" />
                    <Skeleton shape="text" className="mt-2 h-3 w-4/5" />
                    <Skeleton shape="text" className="mt-1.5 h-2.5 w-1/3" />
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
