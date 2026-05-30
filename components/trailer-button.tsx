"use client";

import * as React from "react";
import { Play } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from "@/components/ui/dialog";
import { ActionRow } from "@/components/action-row";

interface TrailerButtonProps {
  trailerKey: string;
  titleName: string;
  /** "pill" (default, desktop row) or "row" (mobile More sheet). */
  variant?: "pill" | "row";
}

/**
 * Small pill button that opens a modal with an embedded YouTube trailer.
 * Only render this when you actually have a trailerKey — the parent should
 * gate on that.
 */
export function TrailerButton({ trailerKey, titleName, variant = "pill" }: TrailerButtonProps) {
  const [open, setOpen] = React.useState(false);

  // Only set the iframe src while the dialog is open so we don't preload the
  // player eagerly on every title page.
  const src = open
    ? `https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&rel=0`
    : "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "row" ? (
          <ActionRow icon={<Play className="h-[18px] w-[18px] fill-current" />} label="Watch trailer" />
        ) : (
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-card/80"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Watch trailer
          </button>
        )}
      </DialogTrigger>
      <DialogContent size="lg" className="p-0 sm:max-w-3xl">
        <DialogTitle className="sr-only">{titleName} — trailer</DialogTitle>
        <div className="relative aspect-video w-full overflow-hidden rounded-b-2xl bg-black sm:rounded-lg">
          {open && (
            <iframe
              src={src}
              title={`${titleName} trailer`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
