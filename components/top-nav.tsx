"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCommandPalette } from "@/components/command-palette";
import { ThemeToggle } from "@/components/theme-toggle";
import { PwaInstallButton } from "@/components/pwa-install-button";

const LINKS = [
  { href: "/", label: "Watchlist" },
  { href: "/watching", label: "Watching" },
  { href: "/watched", label: "Watched" },
  { href: "/lists", label: "Lists" },
];

export function TopNav() {
  const pathname = usePathname();
  const { open } = useCommandPalette();

  return (
    <header className="sticky top-0 z-40 w-full glass border-b border-border/60">
      <div className="mx-auto flex h-14 max-w-[1480px] items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-10">
        <div className="flex items-center gap-3">
          <Link href="/" prefetch className="group flex items-center">
            <span className="text-xl font-bold tracking-tight">slate</span>
          </Link>

          <nav className="hidden items-center gap-0.5 md:flex">
            {LINKS.map((l) => {
              const active =
                l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
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

      {/* Mobile nav row — -ml-3.5 on first item so text aligns with "slate" logo above */}
      <nav className="flex items-center gap-1 px-4 pb-2 md:hidden">
        {LINKS.map((l, i) => {
          const active =
            l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              prefetch
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm transition-colors",
                i === 0 && "-ml-3.5",
                active
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
