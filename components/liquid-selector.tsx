"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// The waist between the two bodies is drawn at this width and scaled to fit.
const WAIST_BASE = 100;
const FRAME = 1 / 60;
const SUBSTEPS = 4;

export interface LiquidSprings {
  /** The front of the bead: quick, with a little overshoot. */
  lead: { stiffness: number; damping: number };
  /** The back: slower and heavier, so it holds on and then catches up. */
  tail: { stiffness: number; damping: number };
}

// Tuned on the dock, where the bead is large and travels far.
export const LIQUID_DOCK: LiquidSprings = {
  lead: { stiffness: 250, damping: 23 },
  tail: { stiffness: 150, damping: 21 },
};
// A slider is something you throw: the front lands with a visible overshoot
// and settles, so letting go reads as a release rather than a stop.
export const LIQUID_SLIDER: LiquidSprings = {
  lead: { stiffness: 320, damping: 20 },
  tail: { stiffness: 210, damping: 21 },
};
// Small controls are used far more often, so the same motion plays quicker.
export const LIQUID_CONTROL: LiquidSprings = {
  lead: { stiffness: 380, damping: 29 },
  tail: { stiffness: 235, damping: 26 },
};

// Under a finger the lead follows almost exactly, with just enough give to
// feel soft; the tail keeps its usual lag, so a fast drag stretches the bead.
const HELD = { stiffness: 900, damping: 60 };
// How far a drag must travel before it counts as one, and how hard the bead
// resists being pulled past either end of its track.
const DRAG_SLOP = 6;
const EDGE_GIVE = 0.3;

/** One instant of the bead. Positions are centres, in layer pixels. */
interface Sample {
  lead: number;
  leadVelocity: number;
  tail: number;
  tailVelocity: number;
  width: number;
  widthVelocity: number;
  tailWidth: number;
  tailWidthVelocity: number;
}

interface Slot {
  centre: number;
  width: number;
}

interface Geometry {
  slots: Slot[];
  top: number;
  height: number;
  /** A typical slot width: the yardstick for stretch and speed. */
  unit: number;
  /** A touch drag would fight a sideways-scrolling parent. */
  scrolls: boolean;
}

interface Flight {
  samples: Sample[];
  target: number;
  clock: Animation;
  animations: Animation[];
}

function clamp01(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

function smooth(value: number) {
  const x = clamp01(value);
  return x * x * (3 - 2 * x);
}

function atRest(slot: Slot): Sample {
  return {
    lead: slot.centre,
    leadVelocity: 0,
    tail: slot.centre,
    tailVelocity: 0,
    width: slot.width,
    widthVelocity: 0,
    tailWidth: slot.width,
    tailWidthVelocity: 0,
  };
}

function step(
  state: Sample,
  aim: Slot,
  lead: LiquidSprings["lead"],
  tail: LiquidSprings["tail"],
  dt: number,
) {
  state.leadVelocity +=
    (lead.stiffness * (aim.centre - state.lead) -
      lead.damping * state.leadVelocity) *
    dt;
  state.lead += state.leadVelocity * dt;
  state.widthVelocity +=
    (lead.stiffness * (aim.width - state.width) -
      lead.damping * state.widthVelocity) *
    dt;
  state.width += state.widthVelocity * dt;
  state.tailVelocity +=
    (tail.stiffness * (state.lead - state.tail) -
      tail.damping * state.tailVelocity) *
    dt;
  state.tail += state.tailVelocity * dt;
  state.tailWidthVelocity +=
    (tail.stiffness * (state.width - state.tailWidth) -
      tail.damping * state.tailWidthVelocity) *
    dt;
  state.tailWidth += state.tailWidthVelocity * dt;
}

/** Work the whole move out up front, one sample per frame. */
function simulate(from: Sample, target: Slot, springs: LiquidSprings): Sample[] {
  const dt = FRAME / SUBSTEPS;
  const state = { ...from };
  const samples: Sample[] = [{ ...from }];

  for (let frame = 0; frame < 90; frame += 1) {
    for (let sub = 0; sub < SUBSTEPS; sub += 1) {
      step(state, target, springs.lead, springs.tail, dt);
    }
    samples.push({ ...state });
    const settled =
      Math.abs(target.centre - state.lead) < 0.15 &&
      Math.abs(state.lead - state.tail) < 0.25 &&
      Math.abs(target.width - state.width) < 0.25 &&
      Math.abs(state.width - state.tailWidth) < 0.4 &&
      Math.abs(state.leadVelocity) < 2 &&
      Math.abs(state.tailVelocity) < 2;
    if (settled) break;
  }

  samples.push(atRest(target));
  return samples;
}

// The shape of each piece at one instant. The bead is drawn from three pieces
// (two ends and the span between their centres), and they must never be told
// apart: all three always share one height, so their outline is a single
// capsule with nothing narrower in the middle. The bead keeps its volume by
// slimming as a whole while it is pulled out, never by thinning its middle.
function stretch(sample: Sample, unit: number) {
  return smooth(Math.abs(sample.lead - sample.tail) / (unit * 1.4));
}

// The one height every piece is drawn at. `held` is 1 while a finger is on
// the bead, which flattens it a little.
function tall(sample: Sample, unit: number, held = 0) {
  const speed = clamp01(Math.abs(sample.leadVelocity) / (unit * 18.75));
  return (1 - speed * 0.04 - stretch(sample, unit) * 0.14 - held * 0.06).toFixed(4);
}

// `base` is the width the piece is laid out at.
function leadTransform(sample: Sample, base: number, unit: number, held = 0) {
  const speed = clamp01(Math.abs(sample.leadVelocity) / (unit * 18.75));
  const wide = (sample.width / base) * (1 + speed * 0.07 + held * 0.035);
  return `translate3d(${(sample.lead - base / 2).toFixed(2)}px, 0, 0) scale(${wide.toFixed(4)}, ${tall(sample, unit, held)})`;
}

function tailTransform(sample: Sample, base: number, unit: number, held = 0) {
  const wide = sample.tailWidth / base;
  return `translate3d(${(sample.tail - base / 2).toFixed(2)}px, 0, 0) scale(${wide.toFixed(4)}, ${tall(sample, unit, held)})`;
}

// The span runs from the lead's centre back to the tail's, flush with both.
function waistTransform(sample: Sample, unit: number, held = 0) {
  const reach = sample.tail - sample.lead;
  return `translate3d(${sample.lead.toFixed(2)}px, 0, 0) scale(${(reach / WAIST_BASE).toFixed(4)}, ${tall(sample, unit, held)})`;
}

/** How much of an option the lead is sitting on. */
function cover(sample: Sample, slot: Slot) {
  return clamp01((0.62 - Math.abs(sample.lead - slot.centre) / slot.width) / 0.3);
}

/** The slot a bead centred at `x` would be, between the two it sits among. */
function slotAt(slots: Slot[], x: number): Slot {
  const last = slots.length - 1;
  if (x <= slots[0].centre) return { centre: x, width: slots[0].width };
  if (x >= slots[last].centre) return { centre: x, width: slots[last].width };
  for (let i = 0; i < last; i += 1) {
    const a = slots[i];
    const b = slots[i + 1];
    if (x <= b.centre) {
      const mix = (x - a.centre) / (b.centre - a.centre);
      return { centre: x, width: a.width + (b.width - a.width) * mix };
    }
  }
  return { centre: x, width: slots[last].width };
}

function nearest(slots: Slot[], x: number) {
  let best = 0;
  for (let i = 1; i < slots.length; i += 1) {
    if (Math.abs(slots[i].centre - x) < Math.abs(slots[best].centre - x)) {
      best = i;
    }
  }
  return best;
}

function insideSidewaysScroller(element: HTMLElement) {
  for (
    let parent = element.parentElement;
    parent && parent !== document.body;
    parent = parent.parentElement
  ) {
    if (parent.scrollWidth <= parent.clientWidth + 1) continue;
    const overflow = window.getComputedStyle(parent).overflowX;
    if (overflow === "auto" || overflow === "scroll") return true;
  }
  return false;
}

export interface LiquidSelectorProps {
  /** Active option, or -1 when none is current. */
  index: number;
  /** Number of options. Each is a child of the track marked `data-liquid-item`. */
  count: number;
  /** The option's content, drawn in the ink colour while the bead is over it. */
  renderInk: (position: number) => React.ReactNode;
  /** Layout classes for each ink copy; match the real option's own. */
  inkClassName?: string;
  /** Option holding keyboard focus, so its ring can sit above the bead. */
  focusedIndex?: number;
  /** A drag was released on another option. */
  onSelect?: (index: number) => void;
  /** Where the bead may go inside the track, e.g. `inset-1` for its padding. */
  insetClassName?: string;
  springs?: LiquidSprings;
  /** Options that cannot be chosen right now are not dragged to either. */
  disabled?: boolean;
  /** The element the two layers are rendered as (`li` inside a list). */
  as?: "span" | "li";
}

/**
 * Slate's selector: a bead of thick liquid in the theme colour that marks the
 * current option. Choosing another sends the front of the bead across while
 * the back holds on, then lets go and catches up; one SVG filter fuses the
 * pieces into a single smooth surface. Options may be any width: the bead
 * takes the width of whatever it lands on.
 *
 * Render it as a child of a positioned track whose options carry
 * `data-liquid-item`. A move is simulated once and handed to the browser as
 * keyframes, so it plays on the compositor and stays fluid while React
 * renders. The bead can also be picked up: drag along the track and it
 * follows the pointer, sits between options for as long as it is held, and on
 * release flows to the nearest one and selects it. Each label turns to the
 * ink colour exactly while the lead is over it.
 *
 * Until the first measurement the track carries no `data-liquid-ready`
 * attribute, so a control can paint a plain selected state in the meantime.
 */
export function LiquidSelector({
  index,
  count,
  renderInk,
  inkClassName,
  focusedIndex = -1,
  onSelect,
  insetClassName = "inset-0",
  springs = LIQUID_CONTROL,
  disabled = false,
  as: Layer = "span",
}: LiquidSelectorProps) {
  const filterId = `liquid-${React.useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const layerRef = React.useRef<HTMLElement | null>(null);
  const leadRef = React.useRef<HTMLSpanElement>(null);
  const tailRef = React.useRef<HTMLSpanElement>(null);
  const waistRef = React.useRef<HTMLSpanElement>(null);
  const inkRefs = React.useRef<(HTMLElement | null)[]>([]);
  const flight = React.useRef<Flight | null>(null);
  const resting = React.useRef<{ slot: Slot; geometry: Geometry } | null>(null);
  const base = React.useRef(0);
  const held = React.useRef(false);
  const latest = React.useRef({ index, onSelect, disabled, springs });
  const [geometry, setGeometry] = React.useState<Geometry | null>(null);
  // The bead appears at once the first time, and fades after that.
  const [fades, setFades] = React.useState(false);

  React.useEffect(() => {
    latest.current = { index, onSelect, disabled, springs };
  });

  React.useLayoutEffect(() => {
    const layer = layerRef.current;
    const track = layer?.parentElement;
    if (!layer || !track) return;

    const measure = () => {
      const items = [
        ...track.querySelectorAll<HTMLElement>(":scope > [data-liquid-item]"),
      ];
      const frame = layer.getBoundingClientRect();
      if (!items.length || !frame.width || !layer.offsetWidth) return;
      // An ancestor may be mid-way through a scale; measure as if it were not.
      const zoom = frame.width / layer.offsetWidth || 1;
      const rects = items.map((item) => item.getBoundingClientRect());
      const slots = rects.map((rect, position) => {
        // A pressed option is briefly scaled; its laid-out width is the truth.
        const laidOut = items[position].offsetWidth;
        const width =
          Math.abs(rect.width / zoom - laidOut) > 1 ? laidOut : rect.width / zoom;
        const centre = (rect.left + rect.width / 2 - frame.left) / zoom;
        return { centre, width };
      });
      const first = rects[0];
      const laidOutHeight = items[0].offsetHeight;
      const height =
        Math.abs(first.height / zoom - laidOutHeight) > 1
          ? laidOutHeight
          : first.height / zoom;
      const top = (first.top + first.height / 2 - frame.top) / zoom - height / 2;
      const next: Geometry = {
        slots,
        top,
        height,
        unit: slots.reduce((sum, slot) => sum + slot.width, 0) / slots.length,
        scrolls: insideSidewaysScroller(track),
      };
      setGeometry((current) => {
        if (
          current &&
          current.slots.length === next.slots.length &&
          Math.abs(current.top - next.top) < 0.1 &&
          Math.abs(current.height - next.height) < 0.1 &&
          current.scrolls === next.scrolls &&
          current.slots.every(
            (slot, position) =>
              Math.abs(slot.centre - next.slots[position].centre) < 0.1 &&
              Math.abs(slot.width - next.slots[position].width) < 0.1,
          )
        ) {
          return current;
        }
        return next;
      });
      track.setAttribute("data-liquid-ready", "");
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    track
      .querySelectorAll(":scope > [data-liquid-item]")
      .forEach((item) => observer.observe(item));
    return () => {
      observer.disconnect();
      track.removeAttribute("data-liquid-ready");
    };
  }, [count]);

  React.useEffect(() => {
    if (!geometry) return;
    const frame = window.requestAnimationFrame(() => setFades(true));
    return () => window.cancelAnimationFrame(frame);
  }, [geometry]);

  /** Draw the bead at one instant. */
  const draw = React.useCallback((sample: Sample, shape: Geometry, press = 0) => {
    const lead = leadRef.current;
    const tail = tailRef.current;
    const waist = waistRef.current;
    if (!lead || !tail || !waist) return;
    lead.style.transform = leadTransform(sample, base.current, shape.unit, press);
    tail.style.transform = tailTransform(sample, base.current, shape.unit, press);
    waist.style.transform = waistTransform(sample, shape.unit, press);
    inkRefs.current.forEach((ink, position) => {
      const slot = shape.slots[position];
      if (ink && slot) ink.style.opacity = String(cover(sample, slot));
    });
  }, []);

  /** Lay both bodies out at `width`; transforms are relative to it. */
  const rebase = React.useCallback((width: number) => {
    base.current = width;
    if (leadRef.current) leadRef.current.style.width = `${width}px`;
    if (tailRef.current) tailRef.current.style.width = `${width}px`;
  }, []);

  /** Where the bead is right now: mid-flight if a move is still playing. */
  const whereabouts = React.useCallback((shape: Geometry): Sample | null => {
    const active = flight.current;
    if (active && active.clock.playState === "running") {
      // Read one frame ahead: that is where the bead will be by the time the
      // next move reaches the screen, so the hand-over does not hop backwards.
      const elapsed = Number(active.clock.currentTime ?? 0) / 1000 + FRAME;
      const last = active.samples.length - 1;
      const at = Math.min(elapsed / FRAME, last);
      const a = active.samples[Math.floor(at)];
      const b = active.samples[Math.min(Math.floor(at) + 1, last)];
      const mix = at - Math.floor(at);
      const between = (key: keyof Sample) => a[key] + (b[key] - a[key]) * mix;
      return {
        lead: between("lead"),
        leadVelocity: between("leadVelocity"),
        tail: between("tail"),
        tailVelocity: between("tailVelocity"),
        width: between("width"),
        widthVelocity: between("widthVelocity"),
        tailWidth: between("tailWidth"),
        tailWidthVelocity: between("tailWidthVelocity"),
      };
    }
    // A layout change moves everything; the bead simply lands in the new one.
    if (resting.current && resting.current.geometry === shape) {
      return atRest(resting.current.slot);
    }
    return null;
  }, []);

  const land = React.useCallback(() => {
    flight.current?.animations.forEach((animation) => animation.cancel());
    flight.current = null;
  }, []);

  /** Send the bead from `from` to rest on `target`. */
  const flow = React.useCallback(
    (from: Sample | null, target: Slot, shape: Geometry) => {
      const lead = leadRef.current;
      const tail = tailRef.current;
      const waist = waistRef.current;
      if (!lead || !tail || !waist) return;
      land();

      // The resting state is always written inline; a move only plays over it.
      rebase(target.width);
      draw(atRest(target), shape);
      resting.current = { slot: target, geometry: shape };

      // First placement, a resize, and reduced motion all simply land.
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (!from || reduceMotion || typeof lead.animate !== "function") return;
      if (
        Math.abs(from.lead - target.centre) < 0.5 &&
        Math.abs(from.tail - target.centre) < 0.5 &&
        Math.abs(from.width - target.width) < 0.5 &&
        Math.abs(from.leadVelocity) < 20
      ) {
        return;
      }

      const samples = simulate(from, target, latest.current.springs);
      const timing: KeyframeAnimationOptions = {
        duration: (samples.length - 1) * FRAME * 1000,
        easing: "linear",
      };
      const width = target.width;
      const animations = [
        lead.animate(
          samples.map((sample) => ({
            transform: leadTransform(sample, width, shape.unit),
          })),
          timing,
        ),
        tail.animate(
          samples.map((sample) => ({
            transform: tailTransform(sample, width, shape.unit),
          })),
          timing,
        ),
        waist.animate(
          samples.map((sample) => ({
            transform: waistTransform(sample, shape.unit),
          })),
          timing,
        ),
      ];
      inkRefs.current.forEach((ink, position) => {
        const slot = shape.slots[position];
        if (!ink || !slot) return;
        animations.push(
          ink.animate(
            samples.map((sample) => ({ opacity: cover(sample, slot) })),
            timing,
          ),
        );
      });
      flight.current = {
        samples,
        target: target.centre,
        clock: animations[0],
        animations,
      };
    },
    [draw, land, rebase],
  );

  // Follow the current option.
  React.useLayoutEffect(() => {
    if (!geometry || index < 0 || held.current) return;
    const target = geometry.slots[index];
    if (!target) return;
    const active = flight.current;
    // A drag released on this option is already on its way there.
    if (
      active &&
      active.target === target.centre &&
      active.clock.playState === "running" &&
      resting.current?.geometry === geometry
    ) {
      return;
    }
    flow(whereabouts(geometry), target, geometry);
  }, [flow, geometry, index, whereabouts]);

  // Pick the bead up. The options keep handling plain taps themselves; this
  // only takes over once the pointer has clearly started to drag sideways.
  React.useEffect(() => {
    const layer = layerRef.current;
    const track = layer?.parentElement;
    if (!layer || !track || !geometry || geometry.slots.length < 2) return;

    const slots = geometry.slots;
    const start = slots[0].centre;
    const end = slots[slots.length - 1].centre;
    let pointer: { id: number; x: number; y: number; dragging: boolean } | null =
      null;
    let state: Sample = atRest(slots[0]);
    let aim: Slot = slots[0];
    let left = 0;
    let zoom = 1;
    let frame = 0;
    let last = 0;
    let ignoreClickUntil = 0;
    let over = -1;

    // Sideways touches belong to the bead, unless they already belong to a
    // scrolling row; vertical ones still scroll the page either way.
    const previousTouchAction = track.style.getPropertyValue("touch-action");
    if (!geometry.scrolls) track.style.setProperty("touch-action", "pan-y");

    const follow = (clientX: number) => {
      const raw = (clientX - left) / zoom;
      const x =
        raw < start
          ? start + (raw - start) * EDGE_GIVE
          : raw > end
            ? end + (raw - end) * EDGE_GIVE
            : raw;
      aim = slotAt(slots, x);
    };

    const tick = (now: number) => {
      const elapsed = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const steps = Math.max(1, Math.round(elapsed / (FRAME / SUBSTEPS)));
      const dt = elapsed / steps;
      const { tail } = latest.current.springs;
      for (let sub = 0; sub < steps; sub += 1) step(state, aim, HELD, tail, dt);
      draw(state, geometry, 1);
      // A small tick each time the bead comes to sit on another option, on
      // devices that can give one.
      const under = nearest(slots, state.lead);
      if (under !== over) {
        if (over !== -1 && "vibrate" in navigator) navigator.vibrate(6);
        over = under;
      }
      frame = window.requestAnimationFrame(tick);
    };

    const pickUp = (event: PointerEvent) => {
      const from = whereabouts(geometry);
      if (!from) return false;
      land();
      state = { ...from };
      // While held, both bodies are drawn against one fixed width.
      rebase(geometry.unit);
      over = -1;
      held.current = true;
      const box = layer.getBoundingClientRect();
      left = box.left;
      zoom = box.width / layer.offsetWidth || 1;
      try {
        track.setPointerCapture(event.pointerId);
      } catch {
        // The pointer is already gone; the release handlers still clean up.
      }
      last = performance.now();
      frame = window.requestAnimationFrame(tick);
      return true;
    };

    const letGo = (commit: boolean) => {
      window.cancelAnimationFrame(frame);
      held.current = false;
      const current = latest.current.index;
      // Throwing the bead carries it a little past where the pointer stopped.
      const reach = state.lead + state.leadVelocity * 0.09;
      const chosen = commit ? nearest(slots, reach) : Math.max(current, 0);
      flow(state, slots[chosen], geometry);
      if (commit && chosen !== current) latest.current.onSelect?.(chosen);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (event.pointerType === "touch" && geometry.scrolls) return;
      if (latest.current.index < 0 || latest.current.disabled) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      pointer = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        dragging: false,
      };
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!pointer || event.pointerId !== pointer.id) return;
      if (!pointer.dragging) {
        const dx = Math.abs(event.clientX - pointer.x);
        const dy = Math.abs(event.clientY - pointer.y);
        // Mostly vertical: this is a scroll, not ours.
        if (dy > 10 && dy > dx) {
          pointer = null;
          return;
        }
        if (dx < DRAG_SLOP) return;
        if (!pickUp(event)) {
          pointer = null;
          return;
        }
        pointer.dragging = true;
      }
      follow(event.clientX);
      event.preventDefault();
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!pointer || event.pointerId !== pointer.id) return;
      const dragged = pointer.dragging;
      pointer = null;
      if (!dragged) return;
      // The browser still sends a click for this press; it is not a tap.
      ignoreClickUntil = performance.now() + 400;
      letGo(true);
    };

    const onPointerCancel = (event: PointerEvent) => {
      if (!pointer || event.pointerId !== pointer.id) return;
      const dragged = pointer.dragging;
      pointer = null;
      if (dragged) letGo(false);
    };

    const onClick = (event: MouseEvent) => {
      if (event.isTrusted && performance.now() < ignoreClickUntil) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const onDragStart = (event: DragEvent) => event.preventDefault();

    track.addEventListener("pointerdown", onPointerDown);
    track.addEventListener("pointermove", onPointerMove);
    track.addEventListener("pointerup", onPointerUp);
    track.addEventListener("pointercancel", onPointerCancel);
    track.addEventListener("click", onClick, true);
    track.addEventListener("dragstart", onDragStart);
    return () => {
      track.removeEventListener("pointerdown", onPointerDown);
      track.removeEventListener("pointermove", onPointerMove);
      track.removeEventListener("pointerup", onPointerUp);
      track.removeEventListener("pointercancel", onPointerCancel);
      track.removeEventListener("click", onClick, true);
      track.removeEventListener("dragstart", onDragStart);
      track.style.setProperty("touch-action", previousTouchAction);
      window.cancelAnimationFrame(frame);
      if (held.current) {
        held.current = false;
        const fallback = slots[Math.max(latest.current.index, 0)];
        if (fallback) flow(null, fallback, geometry);
      }
    };
  }, [draw, flow, geometry, land, rebase, whereabouts]);

  React.useEffect(() => land, [land]);

  const shown = index !== -1 && geometry !== null;
  const height = geometry?.height ?? 0;
  // The filter is sized to the bead, so a small control gets the same
  // proportions as the dock rather than a blur that swallows it.
  const blur = Math.max(height * 0.11, 1.6);
  const slope = Math.max(blur * 2, 5);
  const piece =
    "absolute left-0 rounded-full bg-primary will-change-transform";
  const vertical = { top: geometry?.top ?? 0, height };
  const layerClass = cn(
    "pointer-events-none absolute overflow-hidden rounded-[inherit]",
    insetClassName,
    fades && "transition-opacity duration-200",
  );

  return (
    <>
      <Layer
        ref={(node: HTMLElement | null) => {
          layerRef.current = node;
        }}
        aria-hidden
        className={cn(layerClass, "z-20")}
        style={{ opacity: shown ? 1 : 0, filter: `url(#${filterId})` }}
      >
        <svg
          aria-hidden
          focusable="false"
          className="pointer-events-none absolute h-0 w-0"
        >
          <defs>
            <filter
              id={filterId}
              x="-5%"
              y="-25%"
              width="110%"
              height="150%"
              colorInterpolationFilters="sRGB"
            >
              {/* Fuse the pieces: blur them together, then bring the edge
                  back with a slope gentle enough to stay antialiased. */}
              <feGaussianBlur
                in="SourceGraphic"
                stdDeviation={blur.toFixed(2)}
                result="blur"
              />
              <feColorMatrix
                in="blur"
                values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${slope.toFixed(2)} ${(-slope / 2).toFixed(2)}`}
                result="body"
              />
              {/* A soft sheen along the top, as on anything wet. */}
              <feGaussianBlur
                in="body"
                stdDeviation={(blur * 0.73).toFixed(2)}
                result="dome"
              />
              <feSpecularLighting
                in="dome"
                surfaceScale={(height * 0.064).toFixed(2)}
                specularConstant="0.5"
                specularExponent="18"
                lightingColor="white"
                result="sheen"
              >
                <feDistantLight azimuth="262" elevation="46" />
              </feSpecularLighting>
              <feComposite in="sheen" in2="body" operator="in" result="lit" />
              <feComposite
                in="body"
                in2="lit"
                operator="arithmetic"
                k1="0"
                k2="1"
                k3="0.24"
                k4="0"
              />
            </filter>
          </defs>
        </svg>

        <span
          ref={waistRef}
          className={cn(piece, "origin-left rounded-none")}
          style={{ ...vertical, width: WAIST_BASE }}
        />
        <span ref={tailRef} className={piece} style={vertical} />
        <span ref={leadRef} className={piece} style={vertical} />
      </Layer>

      {/* The same labels in the ink colour, each shown only while the lead is
          over it. They sit above the bead; the real options stay underneath. */}
      <Layer
        aria-hidden
        className={cn(layerClass, "z-30 text-primary-foreground")}
        style={{ opacity: shown ? 1 : 0 }}
      >
        {geometry
          ? geometry.slots.map((slot, position) => (
              <span
                key={position}
                ref={(node) => {
                  inkRefs.current[position] = node;
                }}
                className={cn(
                  "absolute rounded-full opacity-0 will-change-[opacity]",
                  inkClassName,
                  focusedIndex === position &&
                    "ring-2 ring-inset ring-primary-foreground/70",
                )}
                style={{
                  ...vertical,
                  left: slot.centre - slot.width / 2,
                  width: slot.width,
                }}
              >
                {renderInk(position)}
              </span>
            ))
          : null}
      </Layer>
    </>
  );
}
