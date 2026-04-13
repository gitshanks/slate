"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useNavDirection } from "@/components/nav-direction-context";

const variants = {
  enter: (dir: "left" | "right") => ({
    x: dir === "left" ? 56 : -56,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (dir: "left" | "right") => ({
    x: dir === "left" ? -56 : 56,
    opacity: 0,
  }),
};

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { direction } = useNavDirection();

  return (
    <AnimatePresence mode="wait" initial={false} custom={direction}>
      <motion.main
        key={pathname}
        custom={direction}
        variants={variants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.18, ease: "easeInOut" }}
        className="mx-auto w-full max-w-[1480px] px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-14"
      >
        {children}
      </motion.main>
    </AnimatePresence>
  );
}
