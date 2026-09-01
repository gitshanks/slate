"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { PRIMARY_TAB_TRANSITION } from "@/lib/motion";
import { APP_ROOT } from "@/lib/public-mode";
import { useCommandPalette } from "@/components/command-palette";
import {
  OwnedAppToolbar,
  OwnerMenu,
} from "@/components/owned-app-toolbar";
import { ThemeToggle } from "@/components/theme-toggle";
import { PwaInstallButton } from "@/components/pwa-install-button";
import { SmartSearchBar } from "@/components/smart-search-bar";
import { ViewTransition } from "@/components/view-transition";

const PRIMARY_TAB_HREFS = new Set([
  APP_ROOT,
  "/discover",
  "/previews",
  "/lists",
]);

const PRIMARY_TOOLBAR_LABELS = new Map([
  ["/discover", "Discover"],
  ["/import", "Import"],
  ["/lists", "Lists"],
  ["/profile", "Profile"],
]);

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
  const { open } = useCommandPalette();
  const isExactPrimaryTab = PRIMARY_TAB_HREFS.has(pathname);
  const primaryToolbarLabel = PRIMARY_TOOLBAR_LABELS.get(pathname);

  // The unified Library owns the same collection chrome as shared profiles.
  // Other app routes retain this global navigation bar.
  if (pathname === APP_ROOT || pathname === "/previews") return null;

  const toolbarSearch = (
    <SmartSearchBar surfaceId={`top-nav-smart-search-${pathname}`} />
  );

  if (primaryToolbarLabel) {
    return (
      <OwnedAppToolbar
        id="app-top-nav"
        ariaLabel={`${primaryToolbarLabel} controls`}
        center={
          <div className="col-span-2 col-start-1 row-start-2 flex min-w-0 justify-center md:col-span-1 md:col-start-2 md:row-start-1 md:w-full md:justify-self-center">
            {toolbarSearch}
          </div>
        }
        actions={
          <>
            <span
              aria-hidden
              className="hidden h-10 w-[5.25rem] shrink-0 md:block"
            />
            <ThemeToggle className="h-10 w-10 shrink-0 border border-border bg-foreground/[0.055] text-muted-foreground hover:bg-foreground/[0.09] hover:text-foreground md:hidden lg:inline-flex" />
            <OwnerMenu
              avatarUrl={profile?.avatarUrl ?? null}
              displayName={profile?.displayName ?? "You"}
            />
          </>
        }
      />
    );
  }

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
      <div className="shrink-0">
        {/* Mobile keeps the header in the app shell's normal flow so iOS cannot
          drift it after the keyboard closes. Desktop still uses the existing
          fixed header, with the spacer below preserving document flow. */}
        <header
          id="app-top-nav"
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

  return legacyNav;
}
