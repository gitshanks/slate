"use client";

import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import { ViewTransition } from "@/components/view-transition";
import { pageEnter, PRIMARY_TAB_TRANSITION } from "@/lib/motion";
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

  return (
    <ViewTransition
      name="app-primary-tab-page"
      default="none"
      enter="none"
      exit="none"
      share={{
        [PRIMARY_TAB_TRANSITION]: "app-tab-switch",
        default: "none",
      }}
    >
      <div className="h-full min-h-0">{children}</div>
    </ViewTransition>
  );
}
