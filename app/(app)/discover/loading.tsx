import { Skeleton } from "@/components/ui/skeleton";

export default function DiscoverLoading() {
  return (
    <div>
      <div className="mb-8">
        <Skeleton shape="text" className="h-3 w-24" />
        <Skeleton className="mt-3 h-9 w-64 rounded-md" />
        <Skeleton shape="text" className="mt-3 h-3 w-40" />
      </div>

      <Skeleton className="mb-8 h-9 w-44 rounded-full" />
      <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-10 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-7 4xl:grid-cols-8 5xl:grid-cols-9 6xl:grid-cols-10">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="aspect-[2/3] w-full rounded-xl" />
            <Skeleton shape="text" className="mt-2 h-3 w-4/5" />
            <Skeleton shape="text" className="mt-1.5 h-2.5 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
