"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { flushSync } from "react-dom";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useAccent } from "@/components/accent-provider";
import { ACCENTS } from "@/lib/accent-theme";
import { cn } from "@/lib/utils";

// System sits between the two fixed modes, so the control reads as a scale.
export const THEME_MODES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

/**
 * Changes the theme behind one short crossfade instead of letting every colour
 * on the page snap at once. Falls back to a plain change where view
 * transitions are missing or reduced motion is asked for.
 */
export function useThemeSwitch() {
  const { theme, setTheme } = useTheme();

  const switchTheme = React.useCallback(
    (next: string) => {
      if (next === theme) return;
      const doc = document as Document & {
        startViewTransition?: (options: {
          update: () => void;
          types?: string[];
        }) => unknown;
      };
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (!doc.startViewTransition || reduce) {
        setTheme(next);
        return;
      }
      try {
        doc.startViewTransition({
          update: () => flushSync(() => setTheme(next)),
          types: ["theme-change"],
        });
      } catch {
        // Older engines take only a callback and know no types.
        setTheme(next);
      }
    },
    [theme, setTheme],
  );

  return { theme, switchTheme };
}

export function AccentSwatches({
  ringOffsetClassName = "ring-offset-card",
  className,
}: {
  /** Matches the surface the swatches sit on. */
  ringOffsetClassName?: string;
  className?: string;
}) {
  const { accent, setAccent } = useAccent();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <div
      role="radiogroup"
      aria-label="Accent colour"
      className={cn("flex gap-2", className)}
    >
      {ACCENTS.map((item) => {
        const active = mounted && item.id === accent;
        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={item.label}
            title={item.label}
            onClick={() => setAccent(item.id)}
            style={{ backgroundColor: item.swatch }}
            className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-full outline-none ring-offset-2 transition-[transform,box-shadow] duration-150 ease-[var(--ease-ui-out)] focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.92]",
              ringOffsetClassName,
              active
                ? "ring-2 ring-foreground/70"
                : "[@media(hover:hover)_and_(pointer:fine)]:hover:ring-2 [@media(hover:hover)_and_(pointer:fine)]:hover:ring-foreground/20",
            )}
          >
            <Check
              aria-hidden
              strokeWidth={3}
              className={cn(
                "h-3.5 w-3.5 text-black/75 transition-[opacity,transform] duration-150 ease-[var(--ease-ui-out)]",
                active ? "opacity-100" : "scale-75 opacity-0",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
