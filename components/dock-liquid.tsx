"use client";

import type { LucideIcon } from "lucide-react";
import { LIQUID_DOCK, LiquidSelector } from "@/components/liquid-selector";

export interface DockLiquidItem {
  label: string;
  icon: LucideIcon;
}

/**
 * The dock's selector: Slate's liquid bead at its largest. Tapping a tab sends
 * it across; it can also be picked up and dragged along the dock, and on
 * release it flows to the nearest tab and opens it. Each tab's `<li>` carries
 * `data-liquid-item`; this renders the two layers that sit above them.
 */
export function DockLiquid({
  index,
  items,
  focusedIndex = -1,
  onSelect,
}: {
  /** Active slot, or -1 when no tab is current. */
  index: number;
  items: readonly DockLiquidItem[];
  /** Slot holding keyboard focus, so its ring can sit above the bead. */
  focusedIndex?: number;
  /** A drag was released on another tab. */
  onSelect?: (index: number) => void;
}) {
  return (
    <LiquidSelector
      as="li"
      index={index}
      count={items.length}
      focusedIndex={focusedIndex}
      onSelect={onSelect}
      springs={LIQUID_DOCK}
      insetClassName="inset-1"
      inkClassName="grid min-w-0 grid-rows-[20px_11px] content-center justify-items-center gap-[5px] px-1 text-[11px] font-medium tracking-tight max-[359px]:px-0 max-[359px]:text-[10px]"
      renderInk={(position) => {
        const item = items[position];
        if (!item) return null;
        const Icon = item.icon;
        return (
          <>
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
            <span className="max-w-full truncate leading-[11px]">
              {item.label}
            </span>
          </>
        );
      }}
    />
  );
}
