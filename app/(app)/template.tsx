"use client";

import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import { pageEnter } from "@/lib/motion";
import { APP_ROOT } from "@/lib/public-mode";

const PRIMARY_TABS = new Set([APP_ROOT, "/discover", "/lists"]);

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Detail and utility pages keep the established lightweight entrance. Only
  // the three sibling tab destinations participate in the shared crossfade.
  if (!PRIMARY_TABS.has(pathname)) {
    return (
      <motion.div
        key={pathname}
        className="h-full min-h-0"
        variants={pageEnter}
        initial="hidden"
        animate="visible"
      >
        {children}
      </motion.div>
    );
  }

  // Primary tabs use the stable root viewport snapshot for their native
  // handoff. Keeping this surface unnamed avoids morphing between Library's
  // full-height scroller and the shorter document-flow Discover/Lists pages.
  return (
    <div className="h-full min-h-0 bg-background md:min-h-[calc(100svh-7rem)] lg:min-h-[calc(100svh-8rem)]">
      {children}
    </div>
  );
}
