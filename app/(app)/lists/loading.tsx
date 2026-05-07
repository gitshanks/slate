import { Skeleton } from "@/components/ui/skeleton";

export default function ListsLoading() {
  return (
    <div>
      {/* Header — eyebrow + h1 on the left, New-list trigger on the right */}
      <div className="mb-8 flex items-end justify-between gap-4 sm:mb-10">
        <div>
          <Skeleton shape="text" className="h-3 w-24" />
          <Skeleton className="mt-3 h-9 w-24 rounded-md" />
        </div>
        <Skeleton className="h-10 w-28 rounded-md" />
      </div>

      {/* Card grid — match the live page's responsive shape */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton
            key={i}
            className="min-h-[140px] rounded-2xl sm:h-[176px]"
          />
        ))}
      </div>
    </div>
  );
}
