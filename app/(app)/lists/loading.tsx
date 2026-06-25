import { Skeleton } from "@/components/ui/skeleton";

export default function ListsLoading() {
  return (
    <div>
      {/* Header — eyebrow + h1 on the left, New-list trigger on the right */}
      <div className="mb-8 flex items-end justify-between gap-4 sm:mb-10">
        <div>
          <Skeleton shape="text" className="h-3 w-24" />
          <Skeleton className="mt-1 h-9 w-24 rounded-md" />
        </div>
        <Skeleton className="h-10 w-28 rounded-md" />
      </div>

      {/* Card grid — matches the live page: aspect-[16/9] cover + text block */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
            <Skeleton className="aspect-[16/9] w-full rounded-none" />
            <div className="p-4 sm:p-5">
              <Skeleton shape="text" className="h-4 w-2/3" />
              <Skeleton shape="text" className="mt-2 h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
