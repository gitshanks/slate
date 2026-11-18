"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { useAccent } from "@/components/accent-provider";
import {
  ACCENTS,
  ACCENT_ORDER,
  ACCENT_PRIMARY,
  type AccentId,
} from "@/lib/accent-theme";
import { cn } from "@/lib/utils";

type Hsl = readonly [number, number, number];

const THUMB = 32;
const INSET = 4;
const LAST = ACCENT_ORDER.length - 1;
// Under a finger the thumb follows almost exactly, with a little give.
const FOLLOW = { stiffness: 900, damping: 60 };
// Let go, it is thrown to a stop and lands with a small overshoot.
const THROW = { stiffness: 300, damping: 21 };
// Picked up it lifts; set down it settles back with a soft bounce.
const LIFT = { stiffness: 520, damping: 30 };
const SETTLE = { stiffness: 420, damping: 15 };
const LIFTED = 1.16;
// How hard the thumb resists being pulled past either end.
const EDGE_GIVE = 0.25;

// Blending happens in OKLab: a straight line between two colours there passes
// through soft in-betweens, where blending hues would sweep the colour wheel
// (amber to mint through a neon lime) and read as a generic hue picker.
type Vec = [number, number, number];

function hslToRgb([h, s, l]: Hsl): Vec {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) =>
    light - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)];
}

function rgbToHsl([r, g, b]: Vec): Hsl {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l * 100];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h =
    max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return [h, Math.min(s, 1) * 100, l * 100];
}

const toLinear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const toGamma = (c: number) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;

function rgbToOklab(rgb: Vec): Vec {
  const [r, g, b] = rgb.map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToRgb([L, A, B]: Vec): Vec {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const clamp = (c: number) => Math.min(Math.max(c, 0), 1);
  return [
    clamp(toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
    clamp(toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
    clamp(toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)),
  ];
}

function mix(a: Hsl, b: Hsl, f: number): Hsl {
  if (f <= 0) return a;
  if (f >= 1) return b;
  const x = rgbToOklab(hslToRgb(a));
  const y = rgbToOklab(hslToRgb(b));
  return rgbToHsl(
    oklabToRgb([
      x[0] + (y[0] - x[0]) * f,
      x[1] + (y[1] - x[1]) * f,
      x[2] + (y[2] - x[2]) * f,
    ]),
  );
}

/** The colour at a point along the track, between the two accents around it. */
function colourAt(t: number, dark: boolean): Hsl {
  const x = Math.min(Math.max(t, 0), LAST);
  const i = Math.min(Math.floor(x), LAST - 1);
  const pick = (id: AccentId) =>
    dark ? ACCENT_PRIMARY[id].dark : ACCENT_PRIMARY[id].light;
  return mix(pick(ACCENT_ORDER[i]), pick(ACCENT_ORDER[i + 1]), x - i);
}

const hsl = (c: Hsl) =>
  `${c[0].toFixed(1)} ${c[1].toFixed(1)}% ${c[2].toFixed(1)}%`;

/** Where stop `t` sits along the track, as a CSS length. */
const along = (t: number) =>
  `calc(${INSET + THUMB / 2}px + ${((t / LAST) * 100).toFixed(3)}% - ${(((INSET * 2 + THUMB) * t) / LAST).toFixed(3)}px)`;

const LIVE_VARS = [
  "--primary",
  "--primary-hover",
  "--ring",
  "--primary-foreground",
];

/** Tints the whole app while the thumb moves; the stylesheet takes over after. */
function paintLive(t: number, dark: boolean) {
  const style = document.documentElement.style;
  const colour = hsl(colourAt(t, dark));
  const near =
    ACCENT_PRIMARY[ACCENT_ORDER[Math.round(Math.min(Math.max(t, 0), LAST))]];
  style.setProperty("--primary", colour);
  style.setProperty("--primary-hover", colour);
  style.setProperty("--ring", colour);
  style.setProperty(
    "--primary-foreground",
    hsl(dark ? near.inkDark : near.inkLight),
  );
}

function clearLive() {
  const style = document.documentElement.style;
  for (const name of LIVE_VARS) style.removeProperty(name);
}

interface SliderMotion {
  t: number;
  v: number;
  target: number;
  scale: number;
  scaleV: number;
  held: boolean;
  pointer: number;
  live: boolean;
  frame: number;
  last: number;
  over: number;
}

const reduced = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The accent as a colour you slide through, not a row of dots. Grab the thumb
 * (or press anywhere on the track) and the whole app takes the colour under
 * it as you move, blending between accents; let go and the thumb is thrown to
 * the nearest accent, lands with a little give, and the colour settles with
 * it. Motion is simulated per frame on refs, so React never re-renders mid-drag.
 */
export function AccentSlider({ className }: { className?: string }) {
  const { accent, setAccent } = useAccent();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const dark = mounted ? resolvedTheme !== "light" : true;
  const index = Math.max(ACCENT_ORDER.indexOf(accent), 0);

  const trackRef = React.useRef<HTMLDivElement>(null);
  const thumbRef = React.useRef<HTMLSpanElement>(null);
  const width = React.useRef(0);
  const motion = React.useRef<SliderMotion>({
    t: index,
    v: 0,
    target: index,
    scale: 1,
    scaleV: 0,
    held: false,
    pointer: index,
    live: false,
    frame: 0,
    last: 0,
    over: index,
  });
  const latest = React.useRef({ accent, setAccent, dark });
  React.useEffect(() => {
    latest.current = { accent, setAccent, dark };
  });

  const draw = React.useCallback(() => {
    const thumb = thumbRef.current;
    if (!thumb) return;
    const m = motion.current;
    const span = Math.max(width.current - INSET * 2 - THUMB, 0);
    const x = INSET + (m.t / LAST) * span;
    thumb.style.transform = `translate3d(${x.toFixed(2)}px, -50%, 0) scale(${m.scale.toFixed(4)})`;
    thumb.style.backgroundColor = `hsl(${hsl(colourAt(m.t, latest.current.dark))})`;
    if (m.live) paintLive(m.t, latest.current.dark);
  }, []);

  const land = React.useCallback(() => {
    const m = motion.current;
    const chosen = ACCENT_ORDER[Math.round(m.target)];
    if (chosen && chosen !== latest.current.accent) {
      // The stylesheet's class takes over; the inline colour is cleared in the
      // layout effect below once it has, so no frame shows neither.
      latest.current.setAccent(chosen);
    } else {
      m.live = false;
      clearLive();
    }
  }, []);

  const tickRef = React.useRef<(now: number) => void>(() => {});
  React.useEffect(() => {
    tickRef.current = (now: number) => {
      const m = motion.current;
      // Catch up on real time after a dropped frame (small steps keep the
      // springs stable), so a busy device never plays the throw in slow motion.
      const elapsed = Math.min((now - m.last) / 1000, 0.25);
      m.last = now;
      const steps = Math.max(1, Math.round(elapsed / (1 / 240)));
      const dt = elapsed / steps;
      const pull = m.held ? FOLLOW : THROW;
      const lift = m.held ? LIFT : SETTLE;
      const goal = m.held ? m.pointer : m.target;
      const height = m.held ? LIFTED : 1;
      for (let i = 0; i < steps; i += 1) {
        m.v += (-pull.stiffness * (m.t - goal) - pull.damping * m.v) * dt;
        m.t += m.v * dt;
        m.scaleV +=
          (-lift.stiffness * (m.scale - height) - lift.damping * m.scaleV) * dt;
        m.scale += m.scaleV * dt;
      }
      // Pulled past an end, the thumb gives a little and no more.
      const low = -EDGE_GIVE * 0.4;
      const high = LAST + EDGE_GIVE * 0.4;
      if (m.t < low || m.t > high) {
        m.t = Math.min(Math.max(m.t, low), high);
        m.v = 0;
      }
      const under = Math.round(Math.min(Math.max(m.t, 0), LAST));
      if (m.held && under !== m.over && "vibrate" in navigator) {
        navigator.vibrate(6);
      }
      m.over = under;
      const resting =
        !m.held &&
        Math.abs(m.t - m.target) < 0.002 &&
        Math.abs(m.v) < 0.02 &&
        Math.abs(m.scale - 1) < 0.002 &&
        Math.abs(m.scaleV) < 0.02;
      if (resting) {
        m.t = m.target;
        m.scale = 1;
        m.v = 0;
        m.scaleV = 0;
        m.frame = 0;
        draw();
        land();
        return;
      }
      draw();
      m.frame = window.requestAnimationFrame((time) => tickRef.current(time));
    };
  }, [draw, land]);

  const run = React.useCallback(() => {
    const m = motion.current;
    if (m.frame) return;
    m.last = performance.now();
    m.frame = window.requestAnimationFrame((time) => tickRef.current(time));
  }, []);

  /** Go to a stop without a drag (keys). */
  const sendTo = (stop: number) => {
    const m = motion.current;
    m.target = Math.min(Math.max(stop, 0), LAST);
    m.live = true;
    if (reduced()) {
      m.t = m.target;
      draw();
      land();
      return;
    }
    m.scaleV -= 1.2; // a small dip, so a key press is felt too
    run();
  };

  // Measure the track.
  React.useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => {
      width.current = track.clientWidth;
      draw();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, [draw]);

  // The accent changed: either this slider landed (the class now matches the
  // inline colour, so drop it) or it changed elsewhere (sit there directly).
  // A passive effect on purpose: AccentProvider applies the class in one, and
  // passive effects flush together, so no frame is painted between the two.
  React.useEffect(() => {
    const m = motion.current;
    if (m.frame || m.held) return;
    if (m.live) {
      m.live = false;
      clearLive();
    }
    m.t = index;
    m.target = index;
    m.pointer = index;
    m.over = index;
    draw();
  }, [index, draw]);

  // Colours follow the light or dark theme.
  React.useEffect(() => draw(), [dark, draw]);

  React.useEffect(() => {
    const m = motion.current;
    return () => {
      window.cancelAnimationFrame(m.frame);
      m.frame = 0;
      if (m.live) clearLive();
    };
  }, []);

  const pointAt = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return motion.current.t;
    const box = track.getBoundingClientRect();
    const zoom = box.width / (track.offsetWidth || 1);
    const span = Math.max(width.current - INSET * 2 - THUMB, 1);
    const t = (((clientX - box.left) / zoom - INSET - THUMB / 2) / span) * LAST;
    return t < 0 ? t * EDGE_GIVE : t > LAST ? LAST + (t - LAST) * EDGE_GIVE : t;
  };

  const gradient = React.useMemo(() => {
    const stops: string[] = [];
    const samples = 30;
    for (let i = 0; i <= samples; i += 1) {
      const t = (i / samples) * LAST;
      stops.push(`hsl(${hsl(colourAt(t, dark))}) ${along(t)}`);
    }
    return `linear-gradient(to right, ${stops.join(", ")})`;
  }, [dark]);

  const label =
    ACCENTS.find((item) => item.id === accent)?.label ?? "Slate mint";

  const release = () => {
    const m = motion.current;
    if (!m.held) return;
    m.held = false;
    // A flick carries on a little past where the finger stopped.
    m.target = Math.min(Math.max(Math.round(m.t + m.v * 0.09), 0), LAST);
    if (reduced()) {
      m.t = m.target;
      draw();
      land();
      return;
    }
    run();
  };

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label="Accent colour"
      aria-valuemin={0}
      aria-valuemax={LAST}
      aria-valuenow={index}
      aria-valuetext={label}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        const m = motion.current;
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Already released; pointerup still arrives.
        }
        m.held = true;
        m.live = true;
        m.pointer = pointAt(event.clientX);
        if (reduced()) {
          m.t = Math.min(Math.max(m.pointer, 0), LAST);
          draw();
          return;
        }
        run();
      }}
      onPointerMove={(event) => {
        const m = motion.current;
        if (!m.held) return;
        m.pointer = pointAt(event.clientX);
        if (reduced()) {
          m.t = Math.min(Math.max(m.pointer, 0), LAST);
          draw();
        }
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onKeyDown={(event) => {
        const m = motion.current;
        const step =
          event.key === "ArrowRight" || event.key === "ArrowUp"
            ? 1
            : event.key === "ArrowLeft" || event.key === "ArrowDown"
              ? -1
              : 0;
        if (event.key === "Home") sendTo(0);
        else if (event.key === "End") sendTo(LAST);
        else if (step) sendTo(Math.round(m.target) + step);
        else return;
        event.preventDefault();
      }}
      style={{ backgroundImage: gradient }}
      className={cn(
        "relative h-10 w-full cursor-grab touch-pan-y select-none rounded-full shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.08)] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover active:cursor-grabbing",
        className,
      )}
    >
      {/* A faint mark at each accent, so the stops can be found by eye. */}
      {ACCENT_ORDER.map((id, position) => (
        <span
          key={id}
          aria-hidden
          className="pointer-events-none absolute top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/60"
          style={{ left: along(position) }}
        />
      ))}
      <span
        ref={thumbRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-1/2 h-8 w-8 rounded-full border-[3px] border-white shadow-[var(--shadow-thumb)] will-change-transform"
        style={{
          transform: `translate3d(${INSET}px, -50%, 0)`,
          visibility: mounted ? "visible" : "hidden",
        }}
      />
    </div>
  );
}
