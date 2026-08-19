import type { TmdbSearchResult } from "@/lib/tmdb";
import { RailScroller } from "@/components/rail-scroller";
import { TmdbTile } from "@/components/tmdb-tile";
import { MotionGrid, MotionItem } from "@/components/motion-grid";
import {
  LIBRARY_POSTER_GRID_CLASS_NAME,
  LIBRARY_POSTER_RAIL_CLASS_NAME,
} from "@/components/poster-grid-geometry";
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
  /** Use the same compact geometry and card treatment as the Library shelf. */
  presentation?: "default" | "library";
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
  presentation = "default",
}: TmdbRailProps) {
  if (items.length === 0) return null;

  // Defensive dedupe: some TMDB endpoints (and the demo seed) surface the same
  // title twice in one list, which collides on the `${media_type}-${id}` React
  // key and warns. Keep the first occurrence so every tile is unique.
  const seen = new Set<string>();
  const uniqueItems = items.filter((item) => {
    const key = `${item.media_type}-${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const matchLibrary = presentation === "library";

  return (
    <section className={cn("mt-14", className)}>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          {title}
        </h2>
      </div>

      {layout === "grid" ? (
        <MotionGrid
          className={
            matchLibrary
              ? LIBRARY_POSTER_GRID_CLASS_NAME
              : "grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 sm:gap-x-5 sm:gap-y-8 lg:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-7 4xl:grid-cols-8 5xl:grid-cols-9 6xl:grid-cols-10"
          }
        >
          {uniqueItems.map((item) => (
            <MotionItem key={`${item.media_type}-${item.id}`}>
              <TmdbTile
                item={item}
                saved={savedTmdbIds?.has(item.id) ?? false}
                variant="grid"
                presentation={presentation}
              />
            </MotionItem>
          ))}
        </MotionGrid>
      ) : matchLibrary ? (
        <RailScroller>
          <div className={LIBRARY_POSTER_RAIL_CLASS_NAME}>
            {uniqueItems.map((item) => (
              <TmdbTile
                key={`${item.media_type}-${item.id}`}
                item={item}
                saved={savedTmdbIds?.has(item.id) ?? false}
                variant="grid"
                presentation="library"
              />
            ))}
          </div>
        </RailScroller>
      ) : (
        <div>
          <RailScroller>
            {uniqueItems.map((item) => (
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
