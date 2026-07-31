"use client";

import * as React from "react";
import { motion, useInView, useReducedMotion } from "motion/react";

type RevealTag = "h2" | "h3" | "p";

export function TextReveal({
  as: Tag = "h2",
  text,
  className,
  delay = 0,
}: {
  as?: RevealTag;
  text: string;
  className?: string;
  delay?: number;
}) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const isInView = useInView(rootRef, {
    once: true,
    margin: "0px 0px -18% 0px",
  });
  const reduceMotion = useReducedMotion() === true;
  const words = React.useMemo(() => text.split(/\s+/).filter(Boolean), [text]);

  return (
    <div ref={rootRef} className="w-full">
      <Tag aria-label={text} className={className}>
        {words.map((word, index) => (
          <span
            aria-hidden
            key={`${word}-${index}`}
            className="mr-[0.22em] inline-block overflow-hidden align-bottom"
          >
            <motion.span
              className="inline-block will-change-transform"
              initial={reduceMotion ? false : { y: "112%" }}
              animate={
                reduceMotion || isInView ? { y: "0%" } : { y: "112%" }
              }
              transition={{
                duration: 0.72,
                delay: delay + index * 0.035,
                ease: [0.19, 1, 0.22, 1],
              }}
            >
              {word}
            </motion.span>
          </span>
        ))}
      </Tag>
    </div>
  );
}
