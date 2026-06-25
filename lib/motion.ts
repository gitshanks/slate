import type { Variants, Transition } from "motion/react";

// Matches the easing the View Transitions already use, so CSS + JS motion feel identical.
export const EASE = [0.32, 0.72, 0, 1] as const;

export const DUR = {
  fast: 0.15, // taps, toggles, hovers
  base: 0.22, // page entrance, content reveals
  slow: 0.32, // hero / detail-page staged reveals
} as const;

export const RISE = 8;
export const STAGGER = 0.03;
export const STAGGER_MAX = 0.18;

const baseTransition: Transition = { duration: DUR.base, ease: EASE };

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: baseTransition },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: RISE },
  visible: { opacity: 1, y: 0, transition: baseTransition },
};

export const pageEnter: Variants = {
  hidden: { opacity: 0, y: RISE },
  visible: { opacity: 1, y: 0, transition: baseTransition },
};

// Container that staggers its children in. Cap total ripple via STAGGER_MAX
// at the call site by limiting child count or passing a custom delay.
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: STAGGER, when: "beforeChildren" },
  },
};

export const staggerChild: Variants = {
  hidden: { opacity: 0, y: RISE },
  visible: { opacity: 1, y: 0, transition: baseTransition },
};
