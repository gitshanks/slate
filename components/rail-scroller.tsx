"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Horizontal scroll container with Netflix-style arrow navigation.
 *
 * - Touch devices: native axis locking lets horizontal flicks move the rail
 *   while vertical swipes that begin on a poster keep moving the page.
 * - Desktop: left/right arrow buttons that scroll by one "page" width.
 * - Arrows auto-hide when scrolled to the respective edge.
 */
export function RailScroller({
  children,
  enabled = true,
}: {
  children: React.ReactNode;
  enabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  // Vertical centre of the poster artwork. The arrows anchor to this rather
  // than the full tile height — the title/year text below each poster would
  // otherwise drag them down off the artwork. null until measured, so the
  // `top-1/2` class is the fallback.
  const [posterCenter, setPosterCenter] = useState<number | null>(null);

  const updateArrows = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (!enabled) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, [enabled]);

  const measureArrowAnchor = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // Media grids can add a motion wrapper around their tiles. Prefer the
    // explicit artwork marker, then retain the original direct-child fallback.
    const poster =
      el.querySelector<HTMLElement>("[data-rail-poster]") ??
      el.firstElementChild?.firstElementChild ??
      null;
    setPosterCenter(poster ? poster.clientHeight / 2 : null);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => {
      updateArrows();
      measureArrowAnchor();
    };
    sync();
    el.addEventListener("scroll", updateArrows, { passive: true });
    // Resync on resize: window resize changes clientWidth, and the poster
    // height changes at the sm breakpoint (tiles widen).
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      ro.disconnect();
    };
  }, [updateArrows, measureArrowAnchor]);

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
        style={posterCenter != null ? { top: posterCenter } : undefined}
        className={cn(
          "absolute left-1 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center",
          "h-9 w-9 rounded-full bg-background/85 backdrop-blur-sm shadow-md ring-1 ring-border",
          "transition-opacity duration-200",
          "hoverable:flex",
          enabled && canScrollLeft
            ? "opacity-100"
            : "pointer-events-none opacity-0"
        )}
      >
        <ChevronLeft className="h-5 w-5 text-foreground" />
      </button>

      {/* Scroll container */}
      <div
        ref={ref}
        className={cn(
          enabled
            ? "touch-manipulation flex snap-x snap-proximity gap-3 overflow-x-auto overscroll-x-contain pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            : "overflow-visible",
        )}
      >
        {children}
      </div>

      {/* Right arrow */}
      <button
        type="button"
        aria-label="Scroll right"
        onClick={() => scroll("right")}
        style={posterCenter != null ? { top: posterCenter } : undefined}
        className={cn(
          "absolute right-1 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center",
          "h-9 w-9 rounded-full bg-background/85 backdrop-blur-sm shadow-md ring-1 ring-border",
          "transition-opacity duration-200",
          "hoverable:flex",
          enabled && canScrollRight
            ? "opacity-100"
            : "pointer-events-none opacity-0"
        )}
      >
        <ChevronRight className="h-5 w-5 text-foreground" />
      </button>
    </div>
  );
}
