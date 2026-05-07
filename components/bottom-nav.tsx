"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Film, Play, Eye, Layers, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_ROOT } from "@/lib/public-mode";

const TABS = [
  { href: APP_ROOT, label: "Watchlist", icon: Film },
  { href: "/watching", label: "Watching", icon: Play },
  { href: "/watched", label: "Watched", icon: Eye },
  { href: "/lists", label: "Lists", icon: Layers },
  { href: "/import", label: "Import", icon: Upload },
] as const;

/**
 * Mobile-only bottom tab bar. Native-app convention: route nav lives at
 * the thumb-reachable bottom of the screen, the top header keeps just the
 * logo + actions. Hidden on md+ where the desktop top-nav already shows
 * the full pill row.
 *
 * The bar respects iOS safe-area-inset-bottom so home-indicator phones
 * don't crowd the labels.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 glass border-t border-border/60 md:hidden"
      aria-label="Primary"
      style={{
        // Lift the inner row above the iOS home indicator without shrinking
        // the bar's outer height. Falls back to 0 on Android / desktop.
        paddingBottom: "max(env(safe-area-inset-bottom), 0px)",
      }}
    >
      <ul className="mx-auto flex max-w-[1480px] items-stretch px-1 pt-1">
        {TABS.map((t) => {
          const active =
            t.href === APP_ROOT ? pathname === APP_ROOT : pathname.startsWith(t.href);
          const Icon = t.icon;
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                prefetch
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-md px-1 py-1.5 text-[10px] font-medium tracking-tight transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 transition-transform",
                    active && "scale-[1.05]",
                  )}
                  aria-hidden
                />
                <span>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
