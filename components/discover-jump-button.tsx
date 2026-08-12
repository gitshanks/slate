"use client";

import { ArrowDown } from "lucide-react";
import { useReducedMotion } from "motion/react";

export function DiscoverJumpButton() {
  const reduceMotion = useReducedMotion();

  return (
    <button
      type="button"
      onClick={() => {
        document.getElementById("discover")?.scrollIntoView({
          behavior: reduceMotion ? "auto" : "smooth",
          block: "start",
        });
      }}
      className="group inline-flex min-h-10 items-center gap-1.5 rounded-full px-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-3"
    >
      Discover
      <ArrowDown
        className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-y-0.5"
        aria-hidden
      />
    </button>
  );
}
