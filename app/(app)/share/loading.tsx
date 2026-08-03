import { Skeleton } from "@/components/ui/skeleton";

/**
 * /share usually redirects almost instantly (TMDB URL → addTitle → /title/:id),
 * but for the brief moment before the redirect lands we render a centered
 * placeholder rather than letting the watchlist-rails fallback flash.
 */
export default function ShareLoading() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 space-y-3">
        <Skeleton className="h-11 w-11 rounded-xl" />
        <Skeleton shape="text" className="h-3 w-32" />
        <Skeleton shape="text" className="h-10 w-3/4 max-w-lg" />
        <Skeleton shape="text" className="h-4 w-full max-w-xl" />
      </div>
      <div className="rounded-2xl border border-border/70 bg-card/45 p-5">
        <Skeleton shape="text" className="h-4 w-36" />
        <Skeleton className="mt-3 h-20 w-full rounded-xl" />
        <div className="mt-3 flex justify-end">
          <Skeleton shape="button" className="h-10 w-28" />
        </div>
      </div>
    </div>
  );
}
