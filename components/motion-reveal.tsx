"use client";

import { motion } from "motion/react";
import { EASE, DUR, RISE } from "@/lib/motion";

// A single staged reveal. Give increasing `delay` to sequence blocks on a
// detail page (backdrop → poster → metadata → rails). Honors reduced motion
// via the root MotionConfig. Do NOT wrap the morphing hero poster — its
// View Transition owns that movement.
export function MotionReveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: RISE }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR.slow, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}
