"use client";

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
    </header>
  );
}
