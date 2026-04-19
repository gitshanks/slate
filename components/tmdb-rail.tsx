import type { TmdbSearchResult } from "@/lib/tmdb";
import { RailScroller } from "@/components/rail-scroller";
import { TmdbTile } from "@/components/tmdb-tile";

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
    </section>
  );
}
