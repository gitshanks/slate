import { Skeleton } from "@/components/ui/skeleton";

export default function ImportLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* The stage */}
      <Skeleton className="h-[max(400px,calc(100svh-18.5rem))] rounded-[28px] sm:h-[min(74svh,660px)] sm:min-h-[460px]" />

      {/* Where to export from */}
      <div className="mt-10 grid gap-x-10 gap-y-6 sm:mt-12 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item}>
            <Skeleton shape="text" className="h-3.5 w-36" />
            <Skeleton shape="text" className="mt-2.5 h-3 w-full" />
            <Skeleton shape="text" className="mt-2 h-3 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
