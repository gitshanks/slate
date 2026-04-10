"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/star-rating";
import { setRating, setReview } from "@/lib/actions";
import { toast } from "sonner";

export function ReviewSheet({
  titleId,
  titleName,
  initialRating,
  initialReview,
}: {
  titleId: string;
  titleName: string;
  initialRating: number | null;
  initialReview: string | null;
}) {
  const [open, setOpen] = React.useState(false);
  const [rating, setRatingState] = React.useState<number | null>(initialRating);
  const [review, setReviewState] = React.useState<string>(initialReview ?? "");
  const [pending, startTransition] = React.useTransition();

  function save() {
    startTransition(async () => {
      try {
        await setRating(titleId, rating);
        await setReview(titleId, review);
        toast.success("Saved");
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {initialReview || initialRating != null ? "Edit review" : "Rate & review"}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{titleName}</SheetTitle>
            <SheetDescription>
              Rate it and jot down a quick note. Stays just for you.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-8 space-y-6">
            <div>
              <label className="mb-3 block text-xs uppercase tracking-wider text-muted-foreground font-mono">
                Rating
              </label>
              <div className="flex items-center gap-3">
                <StarRating value={rating} onChange={setRatingState} size={28} />
                <span className="text-sm text-muted-foreground font-mono">
                  {rating != null ? `${rating.toFixed(1)} / 5` : "—"}
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="review"
                className="mb-3 block text-xs uppercase tracking-wider text-muted-foreground font-mono"
              >
                Notes
              </label>
              <textarea
                id="review"
                value={review}
                onChange={(e) => setReviewState(e.target.value)}
                rows={8}
                placeholder="What did you think?"
                className="w-full resize-none rounded-lg border border-input bg-background px-4 py-3 text-sm outline-none ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button onClick={save} loading={pending}>
                Save
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
