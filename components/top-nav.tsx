"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE, DUR } from "@/lib/motion";
import { APP_ROOT } from "@/lib/public-mode";
import { useCommandPalette } from "@/components/command-palette";
import { ThemeToggle } from "@/components/theme-toggle";
import { PwaInstallButton } from "@/components/pwa-install-button";

const LINKS = [
  { href: APP_ROOT, label: "Watchlist" },
  { href: "/watching", label: "Watching" },
  { href: "/watched", label: "Watched" },
  { href: "/lists", label: "Lists" },
  { href: "/import", label: "Import" },
];

/**
 * Top navigation. On desktop (md+) it's a single bar with the logo, the
 * route pills, and the trailing search/theme/PWA cluster. On mobile the
 * route pills move to a fixed bottom tab bar (see <BottomNav>) and this
 * header keeps just the logo + the actions cluster, so the whole thing
 * reads as a native-app shell rather than a stacked toolbar.
 */
export function TopNav() {
  const pathname = usePathname();
  const { open } = useCommandPalette();

  return (
    <>
      {/* Fixed instead of sticky: sticky was unpinning on the title page,
          most likely because BackdropHero's relative container or body's
          overflow-x: clip interfered with the sticky containing block.
          Fixed pins to the viewport regardless of ancestor styles. The
          spacer below preserves layout flow so main and the title page's
          negative-margin tricks keep working unchanged. */}
      <header className="fixed inset-x-0 top-0 z-40 w-full glass border-b border-border/60">
      <div className="flex h-14 w-full items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-10">
        <div className="flex items-center gap-3">
          <Link href={APP_ROOT} prefetch className="group flex items-center pt-1 pb-2" aria-label="Slate home">
            <Image
              src="/brand/logo-light.svg"
              alt="Slate"
              width={62}
              height={17}
              priority
              className="hidden h-[17px] w-auto dark:block"
            />
            <Image
              src="/brand/logo-dark.svg"
              alt="Slate"
              width={62}
              height={17}
              priority
              className="h-[17px] w-auto dark:hidden"
            />
          </Link>

          <nav className="hidden items-center gap-0.5 md:flex">
            {LINKS.map((l) => {
              const active =
                l.href === APP_ROOT ? pathname === APP_ROOT : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  prefetch
                  className={cn(
                    "relative rounded-full px-3.5 py-1.5 text-sm transition-colors",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                  )}
                >
                  {/* Shared element: one fill exists at a time and Motion
                      slides it (FLIP) from the old pill to the new one. */}
                  {active && (
                    <motion.span
                      layoutId="nav-active"
                      transition={{ duration: DUR.base, ease: EASE }}
                      className="absolute inset-0 -z-10 rounded-full bg-accent"
                    />
                  )}
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-1">
          <PwaInstallButton />
          <ThemeToggle />
          <button
            type="button"
            onClick={open}
            className="ml-1 hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search & add…</span>
            <kbd className="ml-2 rounded border border-border px-1.5 py-0.5 font-mono text-[11px]">
              ⌘K
            </kbd>
          </button>
          <button
            type="button"
            onClick={open}
            aria-label="Search"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground hover:bg-accent sm:hidden"
          >
            <Search className="h-5 w-5" />
          </button>
        </div>
      </div>
      </header>
      {/* Same-height spacer keeps the document flow as if the header were
          in-flow, so main and the title-page's negative-margin tricks
          keep working unchanged. */}
      <div className="h-14 sm:h-16" aria-hidden />
    </>
  );
}
