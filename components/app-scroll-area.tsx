"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/**
 * The mobile app scrolls this middle region instead of the document, keeping
 * both navigation rows in normal layout flow. The (app) layout persists across
 * route changes, so reset this preserved scroller when its page changes.
 */
export function AppScrollArea({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const previousPathname = React.useRef(pathname);
  const scrollArea = React.useRef<HTMLElement>(null);

  React.useLayoutEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;

    if (scrollArea.current) {
      scrollArea.current.scrollTop = 0;
      scrollArea.current.scrollLeft = 0;
    }
  }, [pathname]);

  return (
    <main
      id="app-scroll-area"
      ref={scrollArea}
      className="min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-4 pt-5 pb-6 sm:px-6 sm:pt-6 md:overflow-visible md:overscroll-auto md:pb-6 lg:px-10 lg:pt-8 lg:pb-8"
    >
      {children}
    </main>
  );
}
