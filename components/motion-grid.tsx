"use client";

import * as React from "react";
import { motion } from "motion/react";
import { EASE, DUR, staggerContainer, staggerChild } from "@/lib/motion";

// A grid/rail wrapper that staggers its children in on mount. Pass the same
// Tailwind layout classes you'd put on the plain container — MotionGrid only
// swaps the element type, not the layout.
export function MotionGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const variants = React.useMemo(
    () => staggerContainer(React.Children.count(children)),
    [children]
  );

  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

// One staggered item. Wrap each card/tile inside a MotionGrid. Also carries
// the press feedback: tapping the cell scales it slightly. The tap lives here
// (the grid cell) rather than on the card surface so it never fights the
// card's CSS hover-lift transform, which is on a descendant element.
export function MotionItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={staggerChild}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: DUR.fast, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
