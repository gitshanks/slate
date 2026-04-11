import Link from "next/link";
import Image from "next/image";
import { Check } from "lucide-react";
import { posterUrl } from "@/lib/tmdb-image";
import { formatTmdbScore, formatYear } from "@/lib/utils";
import type { TmdbSearchResult } from "@/lib/tmdb";

interface TmdbRailProps {
  title: string;
  items: TmdbSearchResult[];
  /** tmdb_ids of titles already in the user's library — shows a "saved" badge. */
  savedTmdbIds?: Set<number>;
}

/**
 * Horizontal scroller of TMDB search results. Each tile deep-links to the
 * discover preview page so the user can review before committing to add.
 *
 * Server component — takes pre-fetched data as props.
 */
export function TmdbRail({ title, items, savedTmdbIds }: TmdbRailProps) {
  if (items.length === 0) return null;

  return (
    <section className="mt-14">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
          {title}
        </h2>
      </div>

      {/* Bleed wrapper carries the negative margin; inner div is the actual
          scroll container. Keeping them separate avoids a Chrome quirk where
          overflow:auto on a flex element ignores negative-margin width. */}
      <div className="-mr-4 sm:-mr-6 lg:-mr-10">
      <div
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 pr-4 sm:pr-6 lg:pr-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const name = item.title ?? item.name ?? "Untitled";
          const date = item.release_date ?? item.first_air_date;
          const year = formatYear(date);
          const score = formatTmdbScore(item.vote_average);
          const poster = posterUrl(item.poster_path, "w342");
          const saved = savedTmdbIds?.has(item.id) ?? false;
          // media_type can be "person" in theory; we filter those out upstream
          const mediaType = item.media_type === "tv" ? "tv" : "movie";

          return (
            <Link
              key={`${item.media_type}-${item.id}`}
              href={`/discover/${mediaType}/${item.id}`}
              prefetch={false}
              className="group block w-[140px] shrink-0 snap-start focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl sm:w-[160px]"
            >
              <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-card hairline transition-all duration-200 ease-out hoverable:group-hover:-translate-y-1 hoverable:group-hover:shadow-[0_24px_60px_-20px_hsl(var(--primary)/0.35)]">
                {poster ? (
                  <Image
                    src={poster}
                    alt={name}
                    fill
                    sizes="160px"
                    className="object-cover transition-transform duration-300 ease-out hoverable:group-hover:scale-[1.04]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-muted-foreground">
                    {name}
                  </div>
                )}

                {score && (
                  <div className="absolute left-2 top-2 rounded-full bg-black/60 backdrop-blur-sm px-2 py-0.5 text-[11px] font-mono font-medium text-white">
                    {score}
                  </div>
                )}

                {saved && (
                  <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary/90 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                    <Check className="h-3 w-3" />
                    Saved
                  </div>
                )}
              </div>
              <div className="mt-2 px-0.5">
                <p className="truncate text-xs font-medium text-foreground">
                  {name}
                </p>
                {year && (
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {year}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
      </div>
    </section>
  );
}
