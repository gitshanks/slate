"use client";

import * as React from "react";
import { MoreHorizontal } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * Mobile-only overflow control for the title action panel. The primary
 * actions (status + rating) stay inline; everything else collapses behind a
 * single "More" pill that opens a bottom sheet. Keeps the mobile header from
 * wrapping to three rows of pills.
 *
 * The children are the real action components (trailer, providers, add-to-list,
 * note, remove) — they keep all their own behaviour; this just relays them into
 * the sheet, stacked.
 */
export function MoreActionsSheet({ children }: { children: React.ReactNode }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-card/80"
        >
          <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          More
        </button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-t-0 px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] [&>button]:hidden"
      >
        {/* Grabber — the native bottom-sheet affordance. */}
        <div aria-hidden className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted-foreground/25" />
        <SheetHeader className="px-2.5 pb-1 text-left">
          <SheetTitle className="text-base font-semibold">More</SheetTitle>
        </SheetHeader>
        <div className="mt-1 flex flex-col gap-0.5">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
