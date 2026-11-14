"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const FILTER_ID = "slate-dock-mercury";

const metal: React.CSSProperties = {
  background:
    "linear-gradient(180deg, hsl(var(--mercury-top)) 0%, hsl(var(--mercury-mid)) 58%, hsl(var(--mercury-bottom)) 100%)",
};

// The bead is a heavy lead body and a string of smaller ones behind it. Each
// is a little smaller and a little slower than the one ahead, so in flight
// they string out along the path and at rest they sit inside the lead.
// [width and height as a share of one slot, duration in ms]
const TRAIL = [
  [0.74, 0.8, 400],
  [0.62, 0.68, 460],
  [0.54, 0.58, 520],
  [0.48, 0.5, 585],
  [0.42, 0.44, 650],
  [0.38, 0.4, 720],
  [0.34, 0.36, 800],
] as const;
const LEAD_MS = 340;

/**
 * The dock's selector, behaving like a bead of mercury. One SVG filter fuses
 * the lead and its trail into a single surface and lights it, so the bead
 * stretches into a streak, necks, and pulls itself back together instead of
 * sliding. Everything moves on CSS transitions, which keep running while the
 * next route is still rendering.
 */
export function DockMercury({
  index,
  slots,
}: {
  /** Active slot, or -1 when no tab is current. */
  index: number;
  slots: number;
}) {
  const layerRef = React.useRef<HTMLLIElement>(null);
  const [slot, setSlot] = React.useState(0);
  // Positions land without motion until the bead has been placed once.
  const [flowing, setFlowing] = React.useState(false);
  // When no tab is current the bead fades where it last sat.
  const [at, setAt] = React.useState(Math.max(index, 0));
  if (index >= 0 && index !== at) setAt(index);

  React.useLayoutEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const measure = () => setSlot(layer.clientWidth / slots);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(layer);
    return () => observer.disconnect();
  }, [slots]);

  React.useEffect(() => {
    if (!slot || flowing) return;
    const frame = requestAnimationFrame(() => setFlowing(true));
    return () => cancelAnimationFrame(frame);
  }, [flowing, slot]);

  const piece =
    "absolute left-0 top-1/2 rounded-full will-change-transform motion-reduce:transition-none";

  return (
    <li
      ref={layerRef}
      aria-hidden
      className="pointer-events-none absolute inset-1 z-0 overflow-hidden rounded-full transition-opacity duration-200"
      style={{
        opacity: index === -1 || !slot ? 0 : 1,
        filter: `url(#${FILTER_ID})`,
      }}
    >
      <svg
        aria-hidden
        focusable="false"
        className="pointer-events-none absolute h-0 w-0"
      >
        <defs>
          <filter
            id={FILTER_ID}
            x="-10%"
            y="-40%"
            width="120%"
            height="180%"
            colorInterpolationFilters="sRGB"
          >
            {/* Fuse: blur the shapes together, then harden the alpha edge. */}
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feColorMatrix
              in="blur"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -10"
              result="fused"
            />
            {/* Light: treat the fused alpha as a rounded surface. */}
            <feGaussianBlur in="fused" stdDeviation="3.5" result="dome" />
            <feSpecularLighting
              in="dome"
              surfaceScale="5"
              specularConstant="0.9"
              specularExponent="28"
              lightingColor="white"
              result="shine"
            >
              <feDistantLight azimuth="240" elevation="58" />
            </feSpecularLighting>
            <feComposite in="shine" in2="fused" operator="in" result="lit" />
            <feComposite
              in="fused"
              in2="lit"
              operator="arithmetic"
              k1="0"
              k2="1"
              k3="0.75"
              k4="0"
            />
          </filter>
        </defs>
      </svg>

      {[...TRAIL].reverse().map(([width, height, duration]) => (
        <span
          key={duration}
          className={cn(piece, flowing && "transition-transform")}
          style={{
            ...metal,
            width: slot * width,
            height: `${height * 100}%`,
            transform: `translate3d(${at * slot + (slot * (1 - width)) / 2}px, -50%, 0)`,
            transitionDuration: `${duration}ms`,
            // Slow to leave, quick to arrive: the trail hangs back, then
            // snaps into the lead.
            transitionTimingFunction: "cubic-bezier(0.5, 0, 0.2, 1)",
          }}
        />
      ))}
      <span
        className={cn(piece, "h-full", flowing && "transition-transform")}
        style={{
          ...metal,
          width: slot,
          transform: `translate3d(${at * slot}px, -50%, 0)`,
          transitionDuration: `${LEAD_MS}ms`,
          transitionTimingFunction: "cubic-bezier(0.3, 0.85, 0.25, 1)",
        }}
      />
    </li>
  );
}
