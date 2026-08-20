"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, LayoutGrid, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIMARY_TAB_TRANSITION } from "@/lib/motion";
import { APP_ROOT } from "@/lib/public-mode";
import { useCommandPalette } from "@/components/command-palette";
import {
  OwnedAppToolbar,
  OwnerMenu,
} from "@/components/owned-app-toolbar";
import { ThemeToggle } from "@/components/theme-toggle";
import { PwaInstallButton } from "@/components/pwa-install-button";
import { ViewTransition } from "@/components/view-transition";

const PRIMARY_TAB_HREFS = new Set([APP_ROOT, "/discover", "/lists"]);

/**
 * Context and utility navigation. Primary destinations live in the shared
 * bottom dock on every screen size, so this header keeps only the logo and
 * global actions instead of duplicating route controls.
 */
export function TopNav({
  profile,
}: {
  profile?: { displayName: string; avatarUrl: string | null } | null;
}) {
  const pathname = usePathname();
  const { open, openWith, aiEnabled } = useCommandPalette();
  const isExactPrimaryTab = PRIMARY_TAB_HREFS.has(pathname);
  const isProfileRoute = pathname.startsWith("/profile");

  // The unified Library owns the same collection chrome as shared profiles.
  // Other app routes retain this global navigation bar.
  if (pathname === APP_ROOT) return null;

  const legacyNav = (
    <ViewTransition
      name="app-top-nav"
      default="none"
      enter={{
        [PRIMARY_TAB_TRANSITION]: "app-top-nav-enter",
        default: "none",
      }}
      exit={{
        [PRIMARY_TAB_TRANSITION]: "app-top-nav-exit",
        default: "none",
      }}
      share="none"
    >
      <div className={cn("shrink-0", isProfileRoute && "md:hidden")}>
        {/* Mobile keeps the header in the app shell's normal flow so iOS cannot
          drift it after the keyboard closes. Desktop still uses the existing
          fixed header, with the spacer below preserving document flow. */}
        <header
          id={isProfileRoute ? "app-mobile-top-nav" : "app-top-nav"}
          className="relative z-40 w-full shrink-0 glass border-b border-border/60 md:fixed md:inset-x-0 md:top-0"
        >
          <div className="flex h-14 w-full items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-10">
            <div className="flex items-center">
              <Link
                href={APP_ROOT}
                prefetch
                transitionTypes={
                  isExactPrimaryTab ? [PRIMARY_TAB_TRANSITION] : undefined
                }
                className="group flex items-center pt-1 pb-2"
                aria-label="slate home"
              >
                <Image
                  src="/brand/logo-light.svg"
                  alt="slate"
                  width={62}
                  height={17}
                  priority
                  className="hidden dark:block"
                />
                <Image
                  src="/brand/logo-dark.svg"
                  alt="slate"
                  width={62}
                  height={17}
                  priority
                  className="dark:hidden"
                />
              </Link>
            </div>

            <div className="flex items-center gap-1">
              <PwaInstallButton />
              <ThemeToggle />
              {profile ? (
                <OwnerMenu
                  avatarUrl={profile.avatarUrl}
                  displayName={profile.displayName}
                />
              ) : null}
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
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:hidden"
              >
                <Search className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>
        <div className="hidden h-16 md:block" aria-hidden />
      </div>
    </ViewTransition>
  );

  if (!isProfileRoute) return legacyNav;

  return (
    <>
      {legacyNav}
      <div className="hidden md:block">
        <OwnedAppToolbar
          id="app-top-nav"
          position="fixed"
          ariaLabel="Settings controls"
          center={
            <div className="col-start-2 row-start-1 flex min-w-0 justify-center">
              <div className="relative w-[clamp(16rem,34vw,28rem)] min-w-0">
                <button
                  type="button"
                  onClick={() => open()}
                  className={cn(
                    "flex h-10 w-full min-w-0 items-center gap-2.5 rounded-full border border-border bg-foreground/[0.065] pl-4 text-sm text-muted-foreground outline-none transition-[border-color,background-color,color,transform] duration-150 hover:border-primary/45 hover:bg-foreground/[0.09] hover:text-foreground active:scale-[0.995] focus-visible:ring-2 focus-visible:ring-primary/30",
                    aiEnabled ? "pr-12" : "pr-4",
                  )}
                  aria-label="Search titles and people"
                >
                  <Search className="h-4 w-4 shrink-0" />
                  <span className="truncate">Search titles, people, or ask</span>
                </button>
                {aiEnabled ? (
                  <button
                    type="button"
                    onClick={() => openWith({ mode: "ask" })}
                    className="absolute right-1.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-foreground/[0.075] text-muted-foreground outline-none transition-[border-color,background-color,color,transform] duration-150 hover:border-primary/45 hover:bg-primary/10 hover:text-primary active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-primary/30"
                    aria-label="Ask"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
          }
          actions={
            <>
              <div
                className="grid h-10 w-[5.25rem] shrink-0 grid-cols-2 rounded-full border border-border bg-foreground/[0.055] p-0.5"
                role="group"
                aria-label="Open Library view"
              >
                <Link
                  href={APP_ROOT}
                  prefetch
                  aria-label="Open Shelf view"
                  className="inline-flex items-center justify-center rounded-full text-muted-foreground outline-none transition-[background-color,color,transform] duration-150 hover:bg-foreground/[0.09] hover:text-foreground active:scale-[0.97] focus-visible:ring-1 focus-visible:ring-primary/60"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href={`${APP_ROOT}?view=space`}
                  prefetch
                  aria-label="Open Space view"
                  className="inline-flex items-center justify-center rounded-full text-muted-foreground outline-none transition-[background-color,color,transform] duration-150 hover:bg-foreground/[0.09] hover:text-foreground active:scale-[0.97] focus-visible:ring-1 focus-visible:ring-primary/60"
                >
                  <Box className="h-3.5 w-3.5" />
                </Link>
              </div>
              <ThemeToggle className="h-10 w-10 shrink-0 border border-border bg-foreground/[0.055] text-muted-foreground hover:bg-foreground/[0.09] hover:text-foreground md:hidden lg:inline-flex" />
              <OwnerMenu
                avatarUrl={profile?.avatarUrl ?? null}
                displayName={profile?.displayName ?? "You"}
              />
            </>
          }
        />
        <div
          aria-hidden
          style={{
            height:
              "calc(4rem + max(0.75rem, env(safe-area-inset-top)))",
          }}
        />
      </div>
    </>
  );
}
