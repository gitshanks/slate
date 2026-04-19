"use client";

import * as React from "react";
import { NotebookPen } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { setReview } from "@/lib/actions";
import { toast } from "sonner";

export function ReviewSheet({
  titleId,
  titleName,
  initialReview,
}: {
  titleId: string;
  titleName: string;
  initialReview: string | null;
}) {
  const [open, setOpen] = React.useState(false);
  const [review, setReviewState] = React.useState<string>(initialReview ?? "");
  const [pending, startTransition] = React.useTransition();

  function save() {
    startTransition(async () => {
      try {
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-card/80"
      >
        <NotebookPen className="h-3.5 w-3.5 text-muted-foreground" />
        {initialReview ? "Edit note" : "Add note"}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{titleName}</SheetTitle>
            <SheetDescription>
              Jot down your thoughts. Stays just for you.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-8 space-y-6">
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
                rows={10}
                placeholder="What did you think?"
                className="w-full resize-none rounded-lg border border-input bg-background px-4 py-3 text-base sm:text-sm outline-none ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground"
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
