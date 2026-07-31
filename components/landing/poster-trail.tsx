"use client";

import Image from "next/image";
import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { posterUrl } from "@/lib/tmdb-image";

const TRAIL_POSTERS = [
  "/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg",
  "/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg",
  "/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
  "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
  "/VHSzNBTwxV8vh7wylo7O9CLdac.jpg",
  "/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
]
  .map((path) => posterUrl(path, "w185"))
  .filter((src): src is string => Boolean(src));

type TrailEntry = {
  id: number;
  imageIndex: number;
  x: number;
  y: number;
  rotation: number;
  bornAt: number;
};

export function PosterTrail({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion() === true;
  const rootRef = React.useRef<HTMLDivElement>(null);
  const lastPointRef = React.useRef({ x: -200, y: -200 });
  const nextIdRef = React.useRef(0);
  const [canTrail, setCanTrail] = React.useState(false);
  const [entries, setEntries] = React.useState<TrailEntry[]>([]);

  React.useEffect(() => {
    const query = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setCanTrail(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  React.useEffect(() => {
    if (!canTrail || reduceMotion) return;

    const timer = window.setInterval(() => {
      const cutoff = Date.now() - 880;
      React.startTransition(() => {
        setEntries((current) =>
          current.filter((entry) => entry.bornAt > cutoff),
        );
      });
    }, 80);

    return () => window.clearInterval(timer);
  }, [canTrail, reduceMotion]);

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!canTrail || reduceMotion || event.pointerType !== "mouse") return;
      const root = rootRef.current;
      if (!root) return;

      const bounds = root.getBoundingClientRect();
      const point = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
      const dx = point.x - lastPointRef.current.x;
      const dy = point.y - lastPointRef.current.y;
      if (Math.hypot(dx, dy) < 72) return;

      lastPointRef.current = point;
      const id = nextIdRef.current++;
      const entry: TrailEntry = {
        id,
        imageIndex: id % TRAIL_POSTERS.length,
        x: point.x,
        y: point.y,
        rotation: (id % 2 === 0 ? -1 : 1) * (2 + (id % 4)),
        bornAt: Date.now(),
      };

      React.startTransition(() => {
        setEntries((current) => [entry, ...current].slice(0, 12));
      });
    },
    [canTrail, reduceMotion],
  );

  return (
    <div
      ref={rootRef}
      onPointerMove={handlePointerMove}
      className={cn("relative overflow-hidden", className)}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 z-[8]">
        <AnimatePresence>
          {entries.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, scale: 0.7, rotate: entry.rotation - 5 }}
              animate={{ opacity: 0.82, scale: 1, rotate: entry.rotation }}
              exit={{ opacity: 0, scale: 0.66, filter: "blur(7px)" }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="absolute h-36 w-24 overflow-hidden border border-white/20 bg-[#17120e] shadow-[0_18px_50px_rgba(0,0,0,0.42)]"
              style={{ left: entry.x - 48, top: entry.y - 72 }}
            >
              <Image
                src={TRAIL_POSTERS[entry.imageIndex]}
                alt=""
                fill
                sizes="96px"
                className="object-cover"
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {children}
    </div>
  );
}
