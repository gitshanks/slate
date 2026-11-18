"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { flushSync } from "react-dom";
import { Monitor, Moon, Sun } from "lucide-react";
import { LIQUID_SLIDER, LiquidSelector } from "@/components/liquid-selector";
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

/**
 * Light, System and Dark as stops on one track. The thumb is Slate's liquid
 * bead: tap a stop, or grab the thumb and slide it; let go and it is thrown
 * to the nearest stop and lands with a small overshoot. Stops show only their
 * icon; the name appears inside the thumb, so it is read where the thumb is.
 */
export function ThemeSlider({ className }: { className?: string }) {
  const { theme, switchTheme } = useThemeSwitch();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const [focused, setFocused] = React.useState(-1);

  // The thumb answers at once; the theme (a whole-page re-render and a
  // crossfade) follows a frame later, so the throw is never held up.
  const [chosen, setChosen] = React.useState<string | null>(null);
  const value = mounted ? (theme ?? "system") : "";
  if (chosen && chosen === value) setChosen(null);
  const shown = chosen ?? value;

  const choose = (next: string) => {
    if (next === value) {
      setChosen(null);
      return;
    }
    setChosen(next);
    window.requestAnimationFrame(() => {
      window.setTimeout(() => switchTheme(next), 0);
    });
  };

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      onKeyDown={(event) => {
        const step =
          event.key === "ArrowRight" || event.key === "ArrowDown"
            ? 1
            : event.key === "ArrowLeft" || event.key === "ArrowUp"
              ? -1
              : 0;
        if (!step) return;
        event.preventDefault();
        const from = THEME_MODES.findIndex((mode) => mode.value === shown);
        const to = Math.min(Math.max(from + step, 0), THEME_MODES.length - 1);
        choose(THEME_MODES[to].value);
        const buttons = event.currentTarget.querySelectorAll("button");
        (buttons[to] as HTMLButtonElement | undefined)?.focus();
      }}
      className={cn(
        "filter-segmented relative flex h-10 w-full cursor-grab select-none items-stretch rounded-full border border-border bg-muted/50 p-1 active:cursor-grabbing [-webkit-touch-callout:none]",
        className,
      )}
    >
      {THEME_MODES.map(({ value: mode, label, icon: Icon }, position) => {
        const active = shown === mode;
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            tabIndex={active || (!shown && position === 1) ? 0 : -1}
            data-liquid-item
            draggable={false}
            onClick={() => choose(mode)}
            onFocus={(event) => {
              if (event.currentTarget.matches(":focus-visible")) {
                setFocused(position);
              }
            }}
            onBlur={() => setFocused(-1)}
            className="filter-segment relative isolate flex flex-1 touch-manipulation items-center justify-center rounded-full text-muted-foreground outline-none [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
          >
            <Icon aria-hidden className="h-4 w-4" />
          </button>
        );
      })}

      <LiquidSelector
        index={THEME_MODES.findIndex((mode) => mode.value === shown)}
        count={THEME_MODES.length}
        focusedIndex={focused}
        springs={LIQUID_SLIDER}
        onSelect={(position) => {
          const mode = THEME_MODES[position];
          if (mode) choose(mode.value);
        }}
        insetClassName="inset-1"
        inkClassName="inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-xs font-medium"
        renderInk={(position) => {
          const mode = THEME_MODES[position];
          if (!mode) return null;
          const Icon = mode.icon;
          return (
            <>
              <Icon aria-hidden className="h-4 w-4" />
              {mode.label}
            </>
          );
        }}
      />
    </div>
  );
}
