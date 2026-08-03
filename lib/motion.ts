import type { Variants, Transition } from "motion/react";

// Matches the easing the View Transitions already use, so CSS + JS motion feel identical.
export const EASE = [0.32, 0.72, 0, 1] as const;

export const DUR = {
  fast: 0.14, // taps, toggles, hovers
  base: 0.19, // page entrance, content reveals
  slow: 0.28, // hero / detail-page staged reveals
} as const;

export const RISE = 6;
export const STAGGER = 0.018;
export const STAGGER_MAX = 0.1;

const baseTransition: Transition = { duration: DUR.base, ease: EASE };

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: baseTransition },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, transform: `translateY(${RISE}px)` },
  visible: { opacity: 1, transform: "translateY(0px)", transition: baseTransition },
};

export const pageEnter: Variants = {
  hidden: { opacity: 0, transform: `translateY(${RISE}px)` },
  visible: { opacity: 1, transform: "translateY(0px)", transition: baseTransition },
};

export function staggerContainer(childCount: number): Variants {
  const gaps = Math.max(childCount - 1, 1);
  const stagger = Math.min(STAGGER, STAGGER_MAX / gaps);
  return {
    hidden: {
      opacity: 0,
      transform: `translateY(${Math.max(RISE - 2, 0)}px)`,
    },
    visible: {
      opacity: 1,
      transform: "translateY(0px)",
      transition: {
        duration: DUR.base,
        ease: EASE,
        staggerChildren: stagger,
        when: "beforeChildren",
      },
    },
  };
}

export const staggerChild: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: baseTransition,
  },
};
