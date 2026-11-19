"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { flushSync } from "react-dom";
import { Monitor, Moon, Smartphone, Sun, Tablet } from "lucide-react";
import { LIQUID_SLIDER, LiquidSelector } from "@/components/liquid-selector";
import { cn } from "@/lib/utils";

/**
 * System follows the device, so it is drawn as the device: a phone on a
 * phone, a tablet on a tablet, a monitor anywhere else. CSS picks one of the
 * three (`.system-icon` in app/globals.css), so the first paint is already
 * right and nothing waits for JavaScript.
 */
export function SystemIcon({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("system-icon inline-grid", className)}>
      <Monitor className="system-icon-desktop h-full w-full" />
      {/* The device outlines fill their box edge to edge where the sun and
          moon do not, so they are drawn a touch smaller to look the same size. */}
      <Tablet className="system-icon-tablet h-full w-full scale-90" />
      <Smartphone className="system-icon-phone h-full w-full scale-90" />
    </span>
  );
}

// System sits between the two fixed modes, so the control reads as a scale.
export const THEME_MODES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: SystemIcon },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

/** Whether choosing `next` would change what the page looks like. */
export function changesLook(next: string) {
  const dark =
    next === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : next === "dark";
  return dark !== document.documentElement.classList.contains("dark");
}

/**
 * Changes the theme behind one crossfade instead of letting every colour on
 * the page snap at once. The fade is a view transition: two flat images on the
 * compositor, which stays smooth on a phone where transitioning the colour of
 * every element would not. A choice that looks the same (Dark to System on a
 * dark phone) changes nothing on screen, so it gets no fade at all.
 */
export function useThemeSwitch() {
  const { theme, setTheme } = useTheme();

  const switchTheme = React.useCallback(
    (next: string) => {
      if (next === theme) return;
      const doc = document as Document & {
        startViewTransition?: (update: () => void) => {
          finished: Promise<void>;
        };
      };
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (!doc.startViewTransition || reduce || !changesLook(next)) {
        setTheme(next);
        return;
      }
      // Scoped by a class rather than a view-transition type, which older
      // Safari does not know; the callback form works everywhere it exists.
      const root = document.documentElement;
      root.classList.add("theme-fading");
      try {
        doc
          .startViewTransition(() => flushSync(() => setTheme(next)))
          .finished.finally(() => root.classList.remove("theme-fading"));
      } catch {
        root.classList.remove("theme-fading");
        setTheme(next);
      }
    },
    [theme, setTheme],
  );

  return { theme, switchTheme };
}

// How long the thumb is given to land before the page changes. The crossfade
// freezes a picture of the page; taken while the thumb is still moving, the
// thumb would show twice for the length of the fade.
const LAND_BEFORE_FADE = 300;

/**
 * Light, System and Dark as stops on one track. The thumb is Slate's liquid
 * bead: tap a stop, or grab the thumb and slide it; let go and it is thrown
 * to the nearest stop and lands with a small overshoot. Stops show only their
 * icon; the name appears inside the thumb, so it is read where the thumb is.
 * Give it 17rem (272px): every stop is then 88px, room for the longest name
 * ("System" and its icon) with the same 12px or more each side.
 */
export function ThemeSlider({ className }: { className?: string }) {
  const { theme, switchTheme } = useThemeSwitch();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const [focused, setFocused] = React.useState(-1);

  // The thumb answers at once. The page follows once the thumb has landed:
  // first the thumb arrives, then the light changes, never both at once.
  const [chosen, setChosen] = React.useState<string | null>(null);
  const value = mounted ? (theme ?? "system") : "";
  if (chosen && chosen === value) setChosen(null);
  const shown = chosen ?? value;
  const pending = React.useRef(0);
  React.useEffect(() => () => window.clearTimeout(pending.current), []);

  const choose = (next: string) => {
    window.clearTimeout(pending.current);
    if (next === value) {
      setChosen(null);
      return;
    }
    setChosen(next);
    const wait = changesLook(next) ? LAND_BEFORE_FADE : 0;
    pending.current = window.setTimeout(() => switchTheme(next), wait);
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
