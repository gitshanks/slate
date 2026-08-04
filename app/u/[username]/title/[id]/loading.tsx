import { Skeleton } from "@/components/ui/skeleton";

export default function PublicTitleLoading() {
  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 pb-16 pt-8 sm:px-6 sm:pt-10 lg:px-10 lg:pt-12">
      <div className="relative -mx-4 -mt-8 pb-20 sm:-mx-6 sm:-mt-10 lg:-mx-10 lg:-mt-12">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 right-1/2 top-0 -ml-[50vw] -mr-[50vw] -mt-16 h-[calc(100vh+4rem)] min-h-[760px] w-screen overflow-hidden"
        >
          <Skeleton className="absolute inset-0 rounded-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-background/10" />
        </div>

        <div className="relative z-10 px-4 pt-8 sm:px-6 sm:pt-10 lg:px-10 lg:pt-12">
          <Skeleton shape="text" className="mb-8 h-3 w-44" />
          <Skeleton shape="text" className="h-3 w-64" />
          <Skeleton className="mt-2 h-10 w-3/4 max-w-2xl rounded-md md:h-12" />
          <div className="mt-6 flex gap-2">
            <Skeleton className="h-9 w-24 rounded-full" />
            <Skeleton className="h-9 w-28 rounded-full" />
          </div>
          <div className="mt-6 max-w-2xl space-y-2">
            <Skeleton shape="text" />
            <Skeleton shape="text" />
            <Skeleton shape="text" className="w-4/5" />
          </div>
        </div>
      </div>
    </main>
  );
}
