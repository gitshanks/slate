"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AccentSlider } from "@/components/accent-slider";
import { THEME_MODES, ThemeSlider } from "@/components/appearance-controls";

// The arriving icon turns in from a quarter turn back, slightly small and soft,
// so the change reads as one object turning rather than two icons swapping.
const ICON_ARRIVAL: Keyframe[] = [
  { transform: "rotate(-90deg) scale(0.6)", opacity: 0, filter: "blur(2px)" },
  { transform: "rotate(0deg) scale(1)", opacity: 1, filter: "blur(0px)" },
];

/**
 * The trigger shows the mode that was chosen, System included, so every
 * choice visibly changes it. Before the stored choice is known (first paint)
 * it shows the sun or moon the page is in, picked by CSS, so nothing flashes.
 */
function ModeIcon() {
  const { theme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const icon = React.useRef<SVGSVGElement>(null);
  const previous = React.useRef<string | undefined>(undefined);
  const chosen = mounted ? (theme ?? "system") : undefined;

  React.useEffect(() => {
    const before = previous.current;
    previous.current = chosen;
    if (!before || !chosen || before === chosen) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    icon.current?.animate(ICON_ARRIVAL, {
      duration: 320,
      easing: "cubic-bezier(0.23, 1, 0.32, 1)",
    });
  }, [chosen]);

  if (!chosen) {
    return (
      <span aria-hidden className="grid h-4 w-4 place-items-center">
        <Sun className="col-start-1 row-start-1 h-4 w-4 dark:hidden" />
        <Moon className="col-start-1 row-start-1 hidden h-4 w-4 dark:block" />
      </span>
    );
  }
  const Icon =
    THEME_MODES.find((mode) => mode.value === chosen)?.icon ?? Monitor;
  return (
    <span aria-hidden className="grid h-4 w-4 place-items-center">
      <Icon ref={icon} className="h-4 w-4" />
    </span>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Appearance"
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground outline-none transition-[color,background-color,transform] duration-150 ease-[var(--ease-ui-out)] hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.94] data-[state=open]:text-foreground data-[state=open]:[view-transition-name:theme-trigger]",
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
        className="w-[16.5rem] rounded-[1.375rem] p-2 shadow-lg"
      >
        <div className="flex flex-col gap-2">
          <ThemeSlider />
          <AccentSlider />
        </div>
      </PopoverContent>
    </Popover>
  );
}
