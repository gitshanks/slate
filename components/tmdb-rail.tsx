import type { TmdbSearchResult } from "@/lib/tmdb";
import { RailScroller } from "@/components/rail-scroller";
import { TmdbTile } from "@/components/tmdb-tile";
import { cn } from "@/lib/utils";

interface TmdbRailProps {
  title: string;
  items: TmdbSearchResult[];
  /** tmdb_ids of titles already in the user's library — shows a "saved" badge. */
  savedTmdbIds?: Set<number>;
  /**
   * "scroll" (default) is a horizontal rail for busy, multi-rail surfaces
   * like the home page. "grid" wraps everything into view at once — used on
   * detail pages where there's vertical room and the full set should be
   * visible without scrolling.
   */
  layout?: "scroll" | "grid";
  /** Override the section's top spacing (e.g. tighten the first rail under a header). */
  className?: string;
}

/**
 * TMDB results as either a horizontal scroller or a wrapped grid. Each tile
 * deep-links to the discover preview page so the user can review before
 * committing to add.
 *
 * Server component — takes pre-fetched data as props.
 */
export function TmdbRail({
  title,
  items,
  savedTmdbIds,
  layout = "scroll",
  className,
}: TmdbRailProps) {
  if (items.length === 0) return null;

  return (
    <section className={cn("mt-14", className)}>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          {title}
        </h2>
      </div>

      {layout === "grid" ? (
        <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 sm:gap-x-5 sm:gap-y-8 lg:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-7 4xl:grid-cols-8 5xl:grid-cols-9 6xl:grid-cols-10">
          {items.map((item) => (
            <TmdbTile
              key={`${item.media_type}-${item.id}`}
              item={item}
              saved={savedTmdbIds?.has(item.id) ?? false}
              variant="grid"
            />
          ))}
        </div>
      ) : (
        <div>
          <RailScroller>
            {items.map((item) => (
              <TmdbTile
                key={`${item.media_type}-${item.id}`}
                item={item}
                saved={savedTmdbIds?.has(item.id) ?? false}
              />
            ))}
          </RailScroller>
        </div>
      )}
    </section>
  );
}
