"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useAccent } from "@/components/accent-provider";
import { ACCENTS } from "@/lib/accent-theme";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Accent dropdown: the trigger shows the current accent as a single dot;
// clicking opens a popover with the six swatches to choose from.
// Paired with <ThemeToggle> — each control is single-purpose.

export function AccentPicker({ className }: { className?: string }) {
  const { accent, setAccent } = useAccent();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const current = ACCENTS.find((a) => a.id === accent) ?? ACCENTS[0];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Accent color: ${current.label}`}
          title="Accent color"
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card/60 text-muted-foreground transition-colors hover:text-foreground backdrop-blur",
            className
          )}
        >
          <span
            className="h-4 w-4 rounded-full"
            style={{ background: mounted ? current.swatch : ACCENTS[0].swatch }}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-auto p-2"
      >
        <p className="px-1 pb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground font-mono">
          Accent
        </p>
        <div className="flex gap-1.5">
          {ACCENTS.map((a) => {
            const active = mounted && accent === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setAccent(a.id)}
                aria-label={a.label}
                aria-pressed={active}
                title={a.label}
                className={cn(
                  "h-5 w-5 rounded-full ring-offset-2 ring-offset-popover transition-transform",
                  active ? "ring-2 ring-foreground scale-110" : "hover:scale-110"
                )}
                style={{ background: a.swatch }}
              />
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
