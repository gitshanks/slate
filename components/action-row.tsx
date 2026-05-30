"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionRowProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Lucide icon (or any node) shown in the leading tile. */
  icon: React.ReactNode;
  label: string;
  /** Optional second line under the label. */
  sublabel?: string;
  /** Trailing node. Defaults to a chevron; pass `null` to omit (direct actions). */
  trailing?: React.ReactNode;
  /** Red treatment for destructive actions (Remove). */
  destructive?: boolean;
}

/**
 * Full-width menu row used inside the mobile "More" sheet — an icon tile, a
 * label (+ optional sublabel), and a trailing chevron. Replaces the stacked
 * pills that looked cramped in a vertical list. forwardRef + prop spread so it
 * works as a Radix `asChild` trigger (Dialog/Popover/Sheet) or a plain button.
 */
export const ActionRow = React.forwardRef<HTMLButtonElement, ActionRowProps>(
  function ActionRow(
    { icon, label, sublabel, trailing, destructive, className, ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "group/row flex w-full items-center gap-3.5 rounded-2xl px-2.5 py-2.5 text-left",
          "transition-[background-color,transform] duration-150 active:scale-[0.99]",
          "hover:bg-muted/60 active:bg-muted disabled:pointer-events-none disabled:opacity-50",
          className,
        )}
        {...props}
      >
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 transition-colors",
            destructive
              ? "bg-destructive/10 text-destructive ring-destructive/15 group-hover/row:bg-destructive/15"
              : "bg-gradient-to-br from-muted to-muted/50 text-foreground/80 ring-border/60 group-hover/row:from-muted group-hover/row:to-muted",
          )}
        >
          {icon}
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-sm font-medium",
              destructive ? "text-destructive" : "text-foreground",
            )}
          >
            {label}
          </span>
          {sublabel && (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {sublabel}
            </span>
          )}
        </span>

        {trailing === undefined ? (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover/row:translate-x-0.5" />
        ) : (
          trailing
        )}
      </button>
    );
  },
);
