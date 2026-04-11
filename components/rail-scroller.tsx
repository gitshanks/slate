"use client";

import { useEffect, useRef } from "react";

/**
 * Horizontal scroll container for TMDB rails.
 *
 * - `touch-action: pan-x` — overrides the global `* { touch-action: manipulation }`
 *   so iPad swipe-left/right is captured by the rail, not the page.
 * - Non-passive wheel listener — converts vertical mouse-wheel delta to
 *   horizontal scroll so desktop users don't need a trackpad or scrollbar.
 */
export function RailScroller({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      // Let naturally horizontal gestures (trackpad swipe) pass through.
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div
      ref={ref}
      // touch-pan-x overrides the global `touch-action: manipulation`
      className="touch-pan-x flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 pr-4 sm:pr-6 lg:pr-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {children}
    </div>
  );
}
