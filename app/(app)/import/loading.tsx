import { Skeleton } from "@/components/ui/skeleton";

export default function ImportLoading() {
  return (
    <div className="max-w-2xl">
      {/* Header (eyebrow + h1 + lead, no right-side action) */}
      <div className="mb-6 sm:mb-10">
        <Skeleton shape="text" className="h-3 w-16" />
        <Skeleton className="mt-3 h-9 w-56 rounded-md" />
        <div className="mt-3 space-y-2">
          <Skeleton shape="text" className="h-3 w-full" />
          <Skeleton shape="text" className="h-3 w-4/5" />
        </div>
      </div>

      {/* Drop zone */}
      <Skeleton className="h-44 rounded-2xl" />

      {/* Exporting from … cards */}
      <section className="mt-10 sm:mt-12">
        <Skeleton shape="text" className="h-3 w-32" />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      </section>
    </div>
  );
}
