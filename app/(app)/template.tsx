"use client";

import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import { pageEnter } from "@/lib/motion";

// A template (unlike a layout) lets us animate content in on navigation.
// Keying on the pathname guarantees the entrance fires on every route change,
// including sibling routes under the (app) route group where the template
// may not remount on its own. Enter-only: the App Router unmounts old content
// immediately, so a reliable exit animation isn't available — and a fast,
// clean enter is the Linear/Vercel feel anyway.
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      variants={pageEnter}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}
