import { Skeleton } from "@/components/ui/skeleton";

export default function TitleDetailLoading() {
  return (
    <div className="relative -mx-4 -my-8 sm:-mx-6 sm:-my-10 lg:-mx-10 lg:-my-14 pb-20">
      {/* Backdrop hero — mirrors <BackdropHero>: full-bleed, fades to bg. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 right-1/2 top-0 -ml-[50vw] -mr-[50vw] -mt-16 h-[calc(100vh+4rem)] min-h-[760px] w-screen overflow-hidden"
      >
        <Skeleton className="absolute inset-0 rounded-none" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, hsl(var(--background)) 0%, hsl(var(--background) / 0.3) 40%, transparent 85%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, hsl(var(--background) / 0.9) 0%, hsl(var(--background) / 0.7) 35%, hsl(var(--background) / 0.35) 60%, hsl(var(--background) / 0.15) 100%)",
          }}
        />
      </div>

      {/* Content — single column, matches the real page wrapper. */}
      <div className="relative z-10 pt-8 px-4 sm:pt-10 sm:px-6 lg:pt-14 lg:px-10">
        {/* Meta line (runtime · year · ratings · genre) */}
        <Skeleton shape="text" className="h-3 w-64" />

        {/* Title — text-3xl sm:text-4xl md:text-5xl */}
        <Skeleton className="mt-2 h-9 w-3/4 max-w-2xl rounded-md sm:h-10 md:h-12" />

        {/* Action panel */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-32 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>

        {/* Overview */}
        <div className="mt-6 w-full max-w-4xl space-y-2">
          <Skeleton shape="text" />
          <Skeleton shape="text" />
          <Skeleton shape="text" className="w-4/5" />
        </div>

        {/* Cast + Crew — each mirrors PeopleGrid (mt-12, square auto-fill grid) */}
        {[{ w: "w-24", count: 16 }, { w: "w-24", count: 10 }].map((g, gi) => (
          <section key={gi} className="mt-12">
            <Skeleton className={`mb-4 h-6 rounded-md ${g.w}`} />
            <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-x-4 gap-y-6">
              {Array.from({ length: g.count }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="aspect-square w-full rounded-xl" />
                  <Skeleton shape="text" className="mt-2 h-3 w-4/5" />
                  <Skeleton shape="text" className="mt-1 h-2.5 w-3/5" />
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* Recommendations — mirrors TmdbRail layout="grid" (mt-14) */}
        <section className="mt-14">
          <Skeleton className="mb-4 h-6 w-48 rounded-md" />
          <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 sm:gap-x-5 sm:gap-y-8 lg:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-7 4xl:grid-cols-8 5xl:grid-cols-9 6xl:grid-cols-10">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="aspect-[2/3] w-full rounded-xl" />
                <Skeleton shape="text" className="mt-2 h-3 w-4/5" />
                <Skeleton shape="text" className="mt-1.5 h-2.5 w-1/3" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
