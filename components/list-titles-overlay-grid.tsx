"use client";

import {
  MediaGrid,
  type MediaGridReorderContext,
} from "@/components/media-grid";
import { useDiscoverTitleOverlay } from "@/components/discover-title-overlay-context";
import type { TmdbMediaResult } from "@/lib/tmdb";
import type { TitleRow } from "@/lib/supabase";

function toTmdbItem(title: TitleRow): TmdbMediaResult {
  return {
    id: title.tmdb_id,
    media_type: title.media_type,
    title: title.title,
    name: title.title,
    original_title: title.original_title ?? undefined,
    original_name: title.original_title ?? undefined,
    overview: title.overview ?? undefined,
    poster_path: title.poster_path,
    backdrop_path: title.backdrop_path,
    release_date: title.release_date ?? undefined,
    vote_average: title.tmdb_rating ?? undefined,
    vote_count: title.tmdb_vote_count ?? undefined,
  };
}

/**
 * Renders the list's titles through the shared title overlay that Discover,
 * Search, and the command palette also open. `MediaGrid` already stamps each
 * card with `id="shelf-title-{id}"`, which the overlay targets via
 * `getElementById` to anchor the slab back to its source card.
 */
export function ListTitlesOverlayGrid({
  titles,
  reorderContext,
  showCardActions = true,
}: {
  titles: TitleRow[];
  reorderContext: MediaGridReorderContext;
  showCardActions?: boolean;
}) {
  const overlay = useDiscoverTitleOverlay();
  return (
    <MediaGrid
      titles={titles}
      reorderContext={reorderContext}
      showCardActions={showCardActions}
      onTitleSelect={(title) =>
        overlay?.open(toTmdbItem(title), true, `shelf-title-${title.id}`)
      }
    />
  );
}
