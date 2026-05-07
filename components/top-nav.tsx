"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
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

export function TopNav() {
  const pathname = usePathname();
  const { open } = useCommandPalette();

  return (
    <header className="sticky top-0 z-40 w-full glass border-b border-border/60">
      <div className="mx-auto flex h-14 max-w-[1480px] items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-10">
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
                    "rounded-full px-3.5 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={open}
            className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search & add…</span>
            <kbd className="ml-2 rounded border border-border px-1.5 py-0.5 font-mono text-[10px]">
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
          <PwaInstallButton />
          <ThemeToggle />
        </div>
      </div>

      {/* Mobile nav row — see MobileNavRow for the sliding-underline detail. */}
      <MobileNavRow pathname={pathname} />
    </header>
  );
}

interface IndicatorPos {
  left: number;
  width: number;
  top: number;
}

/**
 * Mobile-only nav row with a single sliding underline shared across pills.
 *
 * The pill row owns one absolute-positioned indicator that measures the
 * active <Link>'s offsetLeft / offsetWidth / offsetTop and animates between
 * positions via CSS `transition-[left,width,top]`. That gives a continuous
 * slide between tabs instead of the old fade-die-rebirth (each pill rendered
 * its own underline that was destroyed and recreated on navigation).
 *
 * The first pill keeps `-ml-3.5` so the pill *text* lines up with the
 * content edge below (logo, FilterBar, tile grid). The indicator measures
 * the pill geometry and inset by 14px (the pill's px-3.5 internal padding)
 * so the underline tracks the text width, not the box width.
 */
function MobileNavRow({ pathname }: { pathname: string }) {
  const navRef = React.useRef<HTMLElement | null>(null);
  const [indicator, setIndicator] = React.useState<IndicatorPos | null>(null);

  React.useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () => {
      const active = nav.querySelector<HTMLElement>('[data-active="true"]');
      if (!active) {
        setIndicator(null);
        return;
      }
      // Pill has px-3.5 internal padding; underline tracks the text, not
      // the pill box, so subtract 14px from each side.
      const PAD = 14;
      // Underline sits 4px above the pill bottom (inside the pill) for a
      // tight, descender-clearing gap. The bar itself is 2px tall, so
      // its top edge is at pill_bottom - 6.
      setIndicator({
        left: active.offsetLeft + PAD,
        width: Math.max(0, active.offsetWidth - PAD * 2),
        top: active.offsetTop + active.offsetHeight - 6,
      });
    };
    measure();
    // Re-measure on resize so the indicator tracks the active pill if
    // viewport width / font metrics change.
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [pathname]);

  return (
    <nav
      ref={navRef}
      className="relative flex items-center gap-1 px-4 pb-2 sm:px-6 md:hidden"
    >
      {LINKS.map((l, i) => {
        const active =
          l.href === APP_ROOT ? pathname === APP_ROOT : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            prefetch
            data-active={active ? "true" : undefined}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm transition-colors",
              i === 0 && "-ml-3.5",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {l.label}
          </Link>
        );
      })}

      <span
        aria-hidden
        className="pointer-events-none absolute h-[2px] rounded-full bg-primary transition-[left,width,top,opacity] duration-300 ease-out"
        style={{
          left: indicator?.left ?? 0,
          width: indicator?.width ?? 0,
          top: indicator?.top ?? 0,
          opacity: indicator ? 1 : 0,
        }}
      />
    </nav>
  );
}
