"use client";

import * as React from "react";
import { Box, LayoutGrid } from "lucide-react";
import { LiquidSelector } from "@/components/liquid-selector";
import { cn } from "@/lib/utils";

export type CollectionViewMode = "shelf" | "space";

const VIEWS = [
  { mode: "shelf", label: "Shelf view", icon: LayoutGrid },
  { mode: "space", label: "Space view", icon: Box },
] as const;

/**
 * Shelf / Space switch for a collection. The liquid selector marks the
 * current view and can be dragged across to change it.
 */
export function ViewSwitcher({
  mode,
  disabled,
  onSelect,
  label,
  tone = "app",
}: {
  mode: CollectionViewMode;
  disabled: boolean;
  onSelect: (mode: CollectionViewMode) => void;
  label: string;
  /** `glass` sits on the always-dark public profile header. */
  tone?: "app" | "glass";
}) {
  const [focused, setFocused] = React.useState(-1);

  return (
    <div
      className={cn(
        "view-switcher relative grid h-10 w-[5.25rem] shrink-0 select-none grid-cols-2 rounded-full border p-0.5 [-webkit-touch-callout:none]",
        tone === "glass"
          ? "border-white/12 bg-white/[0.055]"
          : "border-border bg-foreground/[0.055]",
      )}
      role="group"
      aria-label={label}
    >
      {VIEWS.map(({ mode: view, label: viewLabel, icon: Icon }, position) => (
        <button
          key={view}
          type="button"
          data-liquid-item
          draggable={false}
          onClick={() => onSelect(view)}
          onFocus={(event) => {
            if (event.currentTarget.matches(":focus-visible")) {
              setFocused(position);
            }
          }}
          onBlur={() => setFocused(-1)}
          aria-pressed={mode === view}
          aria-label={viewLabel}
          disabled={disabled}
          className={cn(
            "view-switcher-option relative inline-flex touch-manipulation items-center justify-center rounded-full outline-none transition-[color,transform] duration-150 ease-[var(--ease-ui-out)] active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary disabled:pointer-events-none motion-reduce:transition-colors motion-reduce:active:scale-100",
            tone === "glass"
              ? "text-white/52 hover:text-white"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </button>
      ))}

      <LiquidSelector
        index={VIEWS.findIndex((view) => view.mode === mode)}
        count={VIEWS.length}
        focusedIndex={focused}
        disabled={disabled}
        onSelect={(position) => {
          const chosen = VIEWS[position];
          if (chosen) onSelect(chosen.mode);
        }}
        insetClassName="inset-0.5"
        inkClassName="inline-flex items-center justify-center"
        renderInk={(position) => {
          const Icon = VIEWS[position]?.icon;
          return Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null;
        }}
      />
    </div>
  );
}
