import { Skeleton } from "@/components/ui/skeleton";

export default function ImportLoading() {
  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="mb-10 flex items-end justify-between">
        <div>
          <Skeleton shape="text" className="h-3 w-16" />
          <Skeleton className="mt-3 h-9 w-56 rounded-md" />
        </div>
      </div>

      {/* Lead paragraph */}
      <div className="mb-8 space-y-2">
        <Skeleton shape="text" className="h-4 w-full" />
        <Skeleton shape="text" className="h-4 w-5/6" />
      </div>

      {/* Drop zone */}
      <Skeleton className="h-44 rounded-xl" />

      {/* Export-hint cards */}
      <div className="mt-10">
        <Skeleton shape="text" className="h-3 w-32" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
