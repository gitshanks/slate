"use client";

import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import type { LucideIcon } from "lucide-react";
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
  className?: string;
}

export function SegmentedFilter({
  id,
  options,
  value,
  onValueChange,
  fullHeight = false,
  className,
}: SegmentedFilterProps) {
  const reduceMotion = useReducedMotion();

  return (
    <LayoutGroup id={id}>
      <div
        className={cn(
          "inline-flex h-9 items-center rounded-full border border-border bg-card p-1 shadow-sm",
          fullHeight && "p-0",
          className,
        )}
      >
        {options.map(({ value: optionValue, label, icon: Icon }) => {
          const active = value === optionValue;
          return (
            <button
              key={optionValue || "all"}
              type="button"
              aria-pressed={active}
              onClick={() => onValueChange(optionValue)}
              className={cn(
                "filter-segment relative isolate inline-flex items-center justify-center rounded-full px-3 py-1.5 text-center text-xs font-medium",
                fullHeight && "h-full py-0",
                active
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {active && (
                <motion.span
                  aria-hidden
                  layoutId="active-segment"
                  className="absolute inset-0 z-0 rounded-full bg-primary shadow-sm"
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { type: "spring", duration: 0.28, bounce: 0.08 }
                  }
                />
              )}
              <span className="relative z-10 inline-flex items-center justify-center gap-1.5">
                {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
