import { Skeleton } from "@/components/ui/skeleton";

export default function PersonLoading() {
  return (
    <div className="-mx-4 -my-5 sm:-mx-6 sm:-my-6 lg:-mx-10 lg:-my-8 pb-20">
      <div className="px-4 pt-6 sm:px-6 lg:px-10">
        <Skeleton shape="text" className="h-3 w-12" />
      </div>
      <div className="px-4 pt-8 sm:px-6 lg:px-10">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[220px_1fr] md:gap-12">
          <div className="flex justify-center md:justify-start">
            <Skeleton className="aspect-[2/3] w-48 rounded-2xl md:w-full" />
          </div>
          <div>
            <Skeleton shape="text" className="h-3 w-32" />
            <Skeleton className="mt-1 h-10 w-56 rounded-md" />
            <div className="mt-6 space-y-2">
              <Skeleton shape="text" className="h-3.5 w-full" />
              <Skeleton shape="text" className="h-3.5 w-5/6" />
              <Skeleton shape="text" className="h-3.5 w-4/6" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
