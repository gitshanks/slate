"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const FILTER_ID = "slate-dock-liquid";
// The waist between the two bodies is drawn at this width and scaled to fit.
const WAIST_BASE = 100;
const FRAME = 1 / 60;
const SUBSTEPS = 4;

// The lead is a quick spring with a little overshoot, so it lands and settles
// like something soft. The tail chases the lead on a slower, heavier spring.
const LEAD = { stiffness: 250, damping: 23 };
const TAIL = { stiffness: 150, damping: 21 };

interface Sample {
  lead: number;
  leadVelocity: number;
  tail: number;
  tailVelocity: number;
}

interface Flight {
  samples: Sample[];
  clock: Animation;
  animations: Animation[];
}

export interface DockLiquidItem {
  label: string;
  icon: LucideIcon;
}

function clamp01(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

function smooth(value: number) {
  const x = clamp01(value);
  return x * x * (3 - 2 * x);
}

/** Work the whole move out up front, one sample per frame. */
function simulate(from: Sample, target: number): Sample[] {
  const dt = FRAME / SUBSTEPS;
  let { lead, leadVelocity, tail, tailVelocity } = from;
  const samples: Sample[] = [{ ...from }];

  for (let frame = 0; frame < 90; frame += 1) {
    for (let step = 0; step < SUBSTEPS; step += 1) {
      leadVelocity +=
        (LEAD.stiffness * (target - lead) - LEAD.damping * leadVelocity) * dt;
      lead += leadVelocity * dt;
      tailVelocity +=
        (TAIL.stiffness * (lead - tail) - TAIL.damping * tailVelocity) * dt;
      tail += tailVelocity * dt;
    }
    samples.push({ lead, leadVelocity, tail, tailVelocity });
    const settled =
      Math.abs(target - lead) < 0.15 &&
      Math.abs(lead - tail) < 0.25 &&
      Math.abs(leadVelocity) < 2 &&
      Math.abs(tailVelocity) < 2;
    if (settled) break;
  }

  samples.push({ lead: target, leadVelocity: 0, tail: target, tailVelocity: 0 });
  return samples;
}

// The shape of each piece at one instant. The bead keeps its volume: as it
// is pulled out between two tabs both ends slim down and the waist between
// them narrows, but never to a thread. It should read as one thick body
// being stretched, not as two balls on a string.
function stretch(sample: Sample, slot: number) {
  return smooth(Math.abs(sample.lead - sample.tail) / (slot * 1.4));
}

function leadTransform(sample: Sample, slot: number) {
  const speed = clamp01(Math.abs(sample.leadVelocity) / 1500);
  const pulled = stretch(sample, slot);
  return `translate3d(${sample.lead.toFixed(2)}px, 0, 0) scale(${(1 + speed * 0.07).toFixed(4)}, ${(1 - speed * 0.05 - pulled * 0.07).toFixed(4)})`;
}

function tailTransform(sample: Sample, slot: number) {
  const pulled = stretch(sample, slot);
  return `translate3d(${sample.tail.toFixed(2)}px, 0, 0) scale(${(1 - pulled * 0.3).toFixed(4)}, ${(1 - pulled * 0.2).toFixed(4)})`;
}

// The waist runs from the lead's centre back to the tail's.
function waistTransform(sample: Sample, slot: number) {
  const reach = sample.tail - sample.lead;
  const thickness = 0.58 + 0.3 / (1 + (Math.abs(reach) / slot) * 1.2);
  return `translate3d(${(sample.lead + slot / 2).toFixed(2)}px, 0, 0) scale(${(reach / WAIST_BASE).toFixed(4)}, ${thickness.toFixed(4)})`;
}

/** How much of tab `position` the lead is sitting on. */
function cover(sample: Sample, position: number, slot: number) {
  return clamp01((0.62 - Math.abs(sample.lead - position) / slot) / 0.3);
}

/**
 * The dock's selector: a bead of thick liquid in the theme colour. Tapping a
 * tab sends the front of the bead across while the back holds on, then lets
 * go and catches up. One SVG filter fuses the pieces into a single smooth
 * surface.
 *
 * The motion is simulated once per tap and handed to the browser as keyframes,
 * so it plays on the compositor and stays fluid while the next route renders.
 * Each label turns to the ink colour exactly while the lead is over it.
 */
export function DockLiquid({
  index,
  items,
  focusedIndex = -1,
}: {
  /** Active slot, or -1 when no tab is current. */
  index: number;
  items: readonly DockLiquidItem[];
  /** Slot holding keyboard focus, so its ring can sit above the bead. */
  focusedIndex?: number;
}) {
  const slots = items.length;
  const layerRef = React.useRef<HTMLLIElement>(null);
  const leadRef = React.useRef<HTMLSpanElement>(null);
  const tailRef = React.useRef<HTMLSpanElement>(null);
  const waistRef = React.useRef<HTMLSpanElement>(null);
  const inkRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const flight = React.useRef<Flight | null>(null);
  const resting = React.useRef<{ position: number; slot: number } | null>(null);
  const [slot, setSlot] = React.useState(0);

  React.useLayoutEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const measure = () => setSlot(layer.clientWidth / slots);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(layer);
    return () => observer.disconnect();
  }, [slots]);

  React.useLayoutEffect(() => {
    const lead = leadRef.current;
    const tail = tailRef.current;
    const waist = waistRef.current;
    if (!slot || index < 0 || !lead || !tail || !waist) return;

    const target = index * slot;
    const inks = inkRefs.current;
    const end: Sample = {
      lead: target,
      leadVelocity: 0,
      tail: target,
      tailVelocity: 0,
    };

    // Where the bead is right now: mid-flight if a move is still playing.
    let from: Sample | null = null;
    const active = flight.current;
    if (active && active.clock.playState === "running") {
      // Read one frame ahead: that is where the bead will be by the time the
      // new move reaches the screen, so the hand-over does not hop backwards.
      const elapsed = Number(active.clock.currentTime ?? 0) / 1000 + FRAME;
      const last = active.samples.length - 1;
      const at = Math.min(elapsed / FRAME, last);
      const a = active.samples[Math.floor(at)];
      const b = active.samples[Math.min(Math.floor(at) + 1, last)];
      const mix = at - Math.floor(at);
      from = {
        lead: a.lead + (b.lead - a.lead) * mix,
        leadVelocity: a.leadVelocity + (b.leadVelocity - a.leadVelocity) * mix,
        tail: a.tail + (b.tail - a.tail) * mix,
        tailVelocity: a.tailVelocity + (b.tailVelocity - a.tailVelocity) * mix,
      };
    } else if (resting.current && resting.current.slot === slot) {
      const position = resting.current.position;
      from = { lead: position, leadVelocity: 0, tail: position, tailVelocity: 0 };
    }
    active?.animations.forEach((animation) => animation.cancel());
    flight.current = null;

    // The resting state is always written inline; a move only plays over it.
    lead.style.transform = leadTransform(end, slot);
    tail.style.transform = tailTransform(end, slot);
    waist.style.transform = waistTransform(end, slot);
    inks.forEach((ink, position) => {
      if (ink) ink.style.opacity = position === index ? "1" : "0";
    });
    resting.current = { position: target, slot };

    // First placement, a resize, and reduced motion all simply land.
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!from || reduceMotion || typeof lead.animate !== "function") return;
    if (Math.abs(from.lead - target) < 0.5 && Math.abs(from.tail - target) < 0.5) {
      return;
    }

    const samples = simulate(from, target);
    const timing: KeyframeAnimationOptions = {
      duration: (samples.length - 1) * FRAME * 1000,
      easing: "linear",
    };
    const animations = [
      lead.animate(
        samples.map((sample) => ({ transform: leadTransform(sample, slot) })),
        timing,
      ),
      tail.animate(
        samples.map((sample) => ({ transform: tailTransform(sample, slot) })),
        timing,
      ),
      waist.animate(
        samples.map((sample) => ({ transform: waistTransform(sample, slot) })),
        timing,
      ),
    ];
    inks.forEach((ink, position) => {
      if (!ink) return;
      animations.push(
        ink.animate(
          samples.map((sample) => ({
            opacity: cover(sample, position * slot, slot),
          })),
          timing,
        ),
      );
    });
    flight.current = { samples, clock: animations[0], animations };
  }, [index, slot]);

  React.useEffect(
    () => () => {
      flight.current?.animations.forEach((animation) => animation.cancel());
    },
    [],
  );

  const shown = index !== -1 && slot > 0;
  const piece =
    "absolute left-0 top-0 h-full rounded-full bg-primary will-change-transform";

  return (
    <>
      <li
        ref={layerRef}
        aria-hidden
        className="pointer-events-none absolute inset-1 z-20 overflow-hidden rounded-full transition-opacity duration-200"
        style={{ opacity: shown ? 1 : 0, filter: `url(#${FILTER_ID})` }}
      >
        <svg
          aria-hidden
          focusable="false"
          className="pointer-events-none absolute h-0 w-0"
        >
          <defs>
            <filter
              id={FILTER_ID}
              x="-5%"
              y="-25%"
              width="110%"
              height="150%"
              colorInterpolationFilters="sRGB"
            >
              {/* Fuse the pieces: blur them together, then bring the edge
                  back with a slope gentle enough to stay antialiased. */}
              <feGaussianBlur in="SourceGraphic" stdDeviation="5.5" result="blur" />
              <feColorMatrix
                in="blur"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 11 -5.5"
                result="body"
              />
              {/* A soft sheen along the top, as on anything wet. */}
              <feGaussianBlur in="body" stdDeviation="4" result="dome" />
              <feSpecularLighting
                in="dome"
                surfaceScale="3.2"
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
          style={{ width: WAIST_BASE }}
        />
        <span ref={tailRef} className={piece} style={{ width: slot }} />
        <span ref={leadRef} className={piece} style={{ width: slot }} />
      </li>

      {/* The same labels in the ink colour, each shown only while the lead is
          over it. They sit above the bead; the real links stay underneath. */}
      <li
        aria-hidden
        className="pointer-events-none absolute inset-1 z-30 grid overflow-hidden rounded-full text-primary-foreground transition-opacity duration-200"
        style={{
          opacity: shown ? 1 : 0,
          gridTemplateColumns: `repeat(${slots}, minmax(0, 1fr))`,
        }}
      >
        {items.map(({ label, icon: Icon }, position) => (
          <div
            key={label}
            ref={(node) => {
              inkRefs.current[position] = node;
            }}
            className={cn(
              "grid h-full min-w-0 grid-rows-[20px_11px] content-center justify-items-center gap-[5px] rounded-full px-1 text-[11px] font-medium tracking-tight opacity-0 will-change-[opacity] max-[359px]:px-0 max-[359px]:text-[10px]",
              focusedIndex === position &&
                "ring-2 ring-inset ring-primary-foreground/70",
            )}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
            <span className="max-w-full truncate leading-[11px]">{label}</span>
          </div>
        ))}
      </li>
    </>
  );
}
