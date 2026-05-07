"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock, Eye, Check, Layers, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_ROOT } from "@/lib/public-mode";

// Icons mirror AddStatusDropdown's want/watching/watched mapping (Clock /
// Eye / Check) so the same metaphor reads everywhere a title's status is
// surfaced — chip on poster cards, status dropdown, and now the tab bar.
const TABS = [
  { href: APP_ROOT, label: "Watchlist", icon: Clock },
  { href: "/watching", label: "Watching", icon: Eye },
  { href: "/watched", label: "Watched", icon: Check },
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
        // Lift the inner row above the iOS home indicator. Floor at 0.5rem
        // so Android / desktop browsers (no safe-area) still get breathing
        // room between the labels and the bar's bottom edge.
        paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)",
      }}
    >
      <ul className="mx-auto flex max-w-[1480px] items-stretch px-1 pt-2">
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
                  "flex flex-col items-center gap-1.5 rounded-md px-1 py-2 text-[10px] font-medium tracking-tight transition-colors",
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
