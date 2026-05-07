import { Skeleton } from "@/components/ui/skeleton";

/**
 * /share usually redirects almost instantly (TMDB URL → addTitle → /title/:id),
 * but for the brief moment before the redirect lands we render a centered
 * placeholder rather than letting the watchlist-rails fallback flash.
 */
export default function ShareLoading() {
  return (
    <div className="mx-auto max-w-xl py-16">
      <div className="flex flex-col items-center gap-4 text-center">
        <Skeleton className="h-12 w-12 rounded-full" />
        <Skeleton shape="text" className="h-5 w-48" />
        <Skeleton shape="text" className="h-3 w-64" />
      </div>
    </div>
  );
}
