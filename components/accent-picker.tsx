"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useAccent } from "@/components/accent-provider";
import { ACCENTS } from "@/lib/accent-theme";

// Inline accent swatches. The active swatch picks up a foreground ring so
// it reads as selected regardless of which color it is. Paired with the
// <ThemeToggle> triple switch — each control is single-purpose.

export function AccentPicker({ className }: { className?: string }) {
  const { accent, setAccent } = useAccent();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <div
      role="group"
      aria-label="Accent color"
      className={cn(
        "inline-flex h-9 items-center gap-1 rounded-full border border-border bg-card/60 px-1.5 backdrop-blur",
        className
      )}
    >
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
              "h-4 w-4 rounded-full ring-offset-2 ring-offset-card transition-transform",
              active ? "ring-2 ring-foreground scale-110" : "hover:scale-110"
            )}
            style={{ background: a.swatch }}
          />
        );
      })}
    </div>
  );
}
