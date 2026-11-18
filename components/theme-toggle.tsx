"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SegmentedFilter } from "@/components/segmented-filter";
import {
  AccentSwatches,
  THEME_MODES,
  useThemeSwitch,
} from "@/components/appearance-controls";

// The arriving icon turns in from a quarter turn back, slightly small and soft,
// so the change reads as one object turning rather than two icons swapping.
const ICON_ARRIVAL: Keyframe[] = [
  { transform: "rotate(-90deg) scale(0.6)", opacity: 0, filter: "blur(2px)" },
  { transform: "rotate(0deg) scale(1)", opacity: 1, filter: "blur(0px)" },
];

/**
 * The trigger shows what the page looks like right now (sun or moon), never a
 * monitor: System is a preference, not something you see. Both icons are in
 * the markup and CSS picks one, so the first paint is already right.
 */
function ModeIcon() {
  const { resolvedTheme } = useTheme();
  const sun = React.useRef<SVGSVGElement>(null);
  const moon = React.useRef<SVGSVGElement>(null);
  const previous = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    const before = previous.current;
    previous.current = resolvedTheme;
    if (!before || !resolvedTheme || before === resolvedTheme) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const arriving = resolvedTheme === "dark" ? moon.current : sun.current;
    arriving?.animate(ICON_ARRIVAL, {
      duration: 320,
      easing: "cubic-bezier(0.23, 1, 0.32, 1)",
    });
  }, [resolvedTheme]);

  return (
    <span aria-hidden className="relative grid h-4 w-4 place-items-center">
      <Sun ref={sun} className="col-start-1 row-start-1 h-4 w-4 dark:hidden" />
      <Moon
        ref={moon}
        className="col-start-1 row-start-1 hidden h-4 w-4 dark:block"
      />
    </span>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, switchTheme } = useThemeSwitch();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Appearance"
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground outline-none transition-[color,background-color,transform] duration-150 ease-[var(--ease-ui-out)] hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.94] data-[state=open]:text-foreground",
            className,
          )}
        >
          <ModeIcon />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        aria-label="Appearance"
        className="w-auto rounded-[1.375rem] p-2 shadow-lg"
      >
        <SegmentedFilter
          id="nav-theme"
          options={THEME_MODES}
          value={mounted ? (theme ?? "system") : ""}
          onValueChange={switchTheme}
          className="flex w-full shadow-none [&>button]:flex-1"
        />
        <AccentSwatches
          ringOffsetClassName="ring-offset-popover"
          className="justify-between px-1.5 pb-1 pt-3"
        />
      </PopoverContent>
    </Popover>
  );
}
