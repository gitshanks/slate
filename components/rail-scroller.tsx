"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Horizontal scroll container with Netflix-style arrow navigation.
 *
 * - Touch devices: native pan-x scroll (iPad swipe scrolls horizontally).
 * - Desktop: left/right arrow buttons that scroll by one "page" width.
 * - Arrows auto-hide when scrolled to the respective edge.
 */
export function RailScroller({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    updateArrows();
    el.addEventListener("scroll", updateArrows, { passive: true });
    // Also update on resize (e.g. window resize changes clientWidth).
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      ro.disconnect();
    };
  }, [updateArrows]);

  const scroll = useCallback((direction: "left" | "right") => {
    const el = ref.current;
    if (!el) return;
    const distance = el.clientWidth * 0.8;
    el.scrollBy({
      left: direction === "left" ? -distance : distance,
      behavior: "smooth",
    });
  }, []);

  return (
    <div className="group/rail relative">
      {/* Left arrow — chevron in a soft pill so the fade doesn't bleed
          a white block over the rail content in light mode. */}
      <button
        type="button"
        aria-label="Scroll left"
        onClick={() => scroll("left")}
        className={cn(
          "absolute left-1 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center",
          "h-9 w-9 rounded-full bg-background/85 backdrop-blur-sm shadow-md ring-1 ring-border",
          "transition-opacity duration-200",
          "hoverable:flex",
          canScrollLeft
            ? "opacity-100"
            : "pointer-events-none opacity-0"
        )}
      >
        <ChevronLeft className="h-5 w-5 text-foreground" />
      </button>

      {/* Scroll container */}
      <div
        ref={ref}
        className="touch-pan-x flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>

      {/* Right arrow */}
      <button
        type="button"
        aria-label="Scroll right"
        onClick={() => scroll("right")}
        className={cn(
          "absolute right-1 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center",
          "h-9 w-9 rounded-full bg-background/85 backdrop-blur-sm shadow-md ring-1 ring-border",
          "transition-opacity duration-200",
          "hoverable:flex",
          canScrollRight
            ? "opacity-100"
            : "pointer-events-none opacity-0"
        )}
      >
        <ChevronRight className="h-5 w-5 text-foreground" />
      </button>
    </div>
  );
}
