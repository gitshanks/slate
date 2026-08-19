"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { APP_ROOT } from "@/lib/public-mode";
import { cn } from "@/lib/utils";

/**
 * The mobile app scrolls this middle region instead of the document, keeping
 * both navigation rows in normal layout flow. The (app) layout persists across
 * route changes, so reset this preserved scroller when its page changes.
 */
export function AppScrollArea({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const previousPathname = React.useRef(pathname);
  const scrollArea = React.useRef<HTMLElement>(null);
  const immersiveLibrary = pathname === APP_ROOT;

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
      className={cn(
        "min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [grid-area:app-stack]",
        immersiveLibrary
          ? "h-full bg-background p-0 [scrollbar-gutter:stable] md:h-dvh md:overscroll-y-contain"
          : "px-4 pt-5 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-6 md:overflow-visible md:overscroll-auto md:pb-6 lg:px-10 lg:pt-8 lg:pb-8",
      )}
    >
      {children}
    </main>
  );
}
