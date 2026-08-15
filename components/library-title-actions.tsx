"use client";

import { AddTitleToListButton } from "@/components/add-title-to-list-button";
import { RemoveButton } from "@/components/remove-button";
import { ReviewSheet } from "@/components/review-sheet";
import { SentimentRating } from "@/components/sentiment-rating";
import { StatusPill } from "@/components/status-pill";
import type { TitleRow } from "@/lib/types";

interface LibraryTitleActionsProps {
  title: TitleRow;
  lists: { id: string; name: string }[];
  onRemoved: () => void;
}

/**
 * Owner-only controls placed inside the shared title inspector. Keeping them
 * here lets Shelf and Space use the same action surface without putting a
 * noisy icon strip over the artwork.
 */
export function LibraryTitleActions({
  title,
  lists,
  onRemoved,
}: LibraryTitleActionsProps) {
  return (
    <>
      <StatusPill titleId={title.id} status={title.status} />
      <SentimentRating
        titleId={title.id}
        rating={title.rating == null ? null : Number(title.rating)}
      />
      <AddTitleToListButton titleId={title.id} lists={lists} />
      <ReviewSheet
        titleId={title.id}
        titleName={title.title}
        initialReview={title.review}
      />
      <RemoveButton
        titleId={title.id}
        titleName={title.title}
        iconOnly
        redirectOnRemove={false}
        onRemoved={onRemoved}
      />
    </>
  );
}
