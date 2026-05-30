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
        className="rounded-t-2xl pb-[calc(env(safe-area-inset-bottom)+1.5rem)]"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="text-base">More</SheetTitle>
        </SheetHeader>
        <div className="mt-5 flex flex-col items-start gap-2.5">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
