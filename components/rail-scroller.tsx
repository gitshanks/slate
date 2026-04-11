"use client";

import { useEffect, useRef } from "react";

/**
 * Horizontal scroll container for TMDB rails.
 *
 * - `touch-pan-x` — sets `touch-action: pan-x` so iPad swipes scroll the
 *   rail instead of the page. (Requires the global
 *   `* { touch-action: manipulation }` rule to be in @layer base, otherwise
 *   unlayered rules win the cascade.)
 * - Desktop drag-to-scroll — click and drag anywhere in the rail. We use
 *   pointer events filtered by `pointerType === 'mouse'` so native touch
 *   scrolling on iPad is untouched.
 * - Click suppression — if a drag happened, swallow the ensuing click so
 *   the user doesn't accidentally open the tile they were dragging from.
 */
export function RailScroller({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let active = false;
    let dragged = false;
    let startX = 0;
    let startScroll = 0;
    const THRESHOLD = 5; // px before we consider it a drag vs a click

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return; // let touch use native scroll
      active = true;
      dragged = false;
      startX = e.clientX;
      startScroll = el.scrollLeft;
      el.style.cursor = "grabbing";
      el.style.userSelect = "none";
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!active) return;
      const dx = e.clientX - startX;
      if (!dragged && Math.abs(dx) > THRESHOLD) dragged = true;
      if (dragged) el.scrollLeft = startScroll - dx;
    };

    const endDrag = () => {
      if (!active) return;
      active = false;
      el.style.cursor = "";
      el.style.userSelect = "";
    };

    const onClickCapture = (e: MouseEvent) => {
      if (dragged) {
        e.preventDefault();
        e.stopPropagation();
        dragged = false;
      }
    };

    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    el.addEventListener("click", onClickCapture, true);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      el.removeEventListener("click", onClickCapture, true);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="touch-pan-x flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 pr-4 sm:pr-6 lg:pr-10 cursor-grab [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {children}
    </div>
  );
}
