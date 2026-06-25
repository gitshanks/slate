"use client";

import { motion } from "motion/react";
import { staggerContainer, staggerChild } from "@/lib/motion";

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
  return (
    <motion.div
      className={className}
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

// One staggered item. Wrap each card/tile inside a MotionGrid.
export function MotionItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={className} variants={staggerChild}>
      {children}
    </motion.div>
  );
}
