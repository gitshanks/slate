"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { LiquidSelector } from "@/components/liquid-selector";
import { cn } from "@/lib/utils";

export interface SegmentedFilterOption {
  value: string;
  label: string;
  icon?: LucideIcon;
}

interface SegmentedFilterProps {
  id: string;
  options: readonly SegmentedFilterOption[];
  value: string;
  onValueChange: (value: string) => void;
  fullHeight?: boolean;
  /** `sm` is the compact control used inside other surfaces. */
  size?: "md" | "sm";
  className?: string;
}

/**
 * A row of options with Slate's liquid selector marking the current one. The
 * selector draws the chosen label in the ink colour itself, in step with the
 * bead, so the buttons underneath never change colour.
 */
export function SegmentedFilter({
  id,
  options,
  value,
  onValueChange,
  fullHeight = false,
  size = "md",
  className,
}: SegmentedFilterProps) {
  const [focused, setFocused] = React.useState(-1);
  const small = size === "sm";

  // Answer the tap at once. Applying a filter can mean re-rendering a whole
  // shelf, and the selector should not wait for that: it moves to the chosen
  // option straight away and the owner's value catches up behind it.
  const [chosen, setChosen] = React.useState<{
    value: string;
    from: string;
  } | null>(null);
  if (chosen && value !== chosen.from) setChosen(null);
  const shown = chosen ? chosen.value : value;

  // If the owner never takes the value, fall back to what it says.
  React.useEffect(() => {
    if (!chosen) return;
    const giveUp = window.setTimeout(() => setChosen(null), 3000);
    return () => window.clearTimeout(giveUp);
  }, [chosen]);

  const choose = (next: string) => {
    if (next === value) {
      onValueChange(next);
      return;
    }
    setChosen({ value: next, from: value });
    // Hand the change to the owner only after the selector has had a frame to
    // start moving. Its motion then runs off the main thread, so it stays
    // fluid however long the owner takes to re-render.
    window.requestAnimationFrame(() => {
      window.setTimeout(() => onValueChange(next), 0);
    });
  };

  return (
    <div
      data-segmented={id}
      className={cn(
        "filter-segmented relative inline-flex select-none items-center rounded-full border border-border bg-card [-webkit-touch-callout:none]",
        small ? "p-0.5" : "h-9 p-1 shadow-sm",
        fullHeight && "p-0",
        className,
      )}
    >
      {options.map(({ value: optionValue, label, icon: Icon }, position) => {
        const active = shown === optionValue;
        return (
          <button
            key={optionValue || "all"}
            type="button"
            data-liquid-item
            draggable={false}
            aria-pressed={active}
            onClick={() => choose(optionValue)}
            onFocus={(event) => {
              if (event.currentTarget.matches(":focus-visible")) {
                setFocused(position);
              }
            }}
            onBlur={() => setFocused(-1)}
            className={cn(
              "filter-segment relative isolate inline-flex touch-manipulation items-center justify-center rounded-full text-center font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
              small ? "px-2 py-0.5 text-[11px]" : "px-3 py-1.5 text-xs",
              fullHeight && "h-full py-0",
            )}
          >
            <span className="inline-flex items-center justify-center gap-1.5">
              {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
              {label}
            </span>
          </button>
        );
      })}

      {/* Rendered after the options so the first one stays `:first-child`. */}
      <LiquidSelector
        index={options.findIndex((option) => option.value === shown)}
        count={options.length}
        focusedIndex={focused}
        onSelect={(position) => {
          const option = options[position];
          if (option) choose(option.value);
        }}
        insetClassName={fullHeight ? "inset-0" : small ? "inset-0.5" : "inset-1"}
        inkClassName={cn(
          "filter-segment-ink inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium",
          small ? "text-[11px]" : "text-xs",
        )}
        renderInk={(position) => {
          const option = options[position];
          if (!option) return null;
          const Icon = option.icon;
          return (
            <>
              {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
              {option.label}
            </>
          );
        }}
      />
    </div>
  );
}
