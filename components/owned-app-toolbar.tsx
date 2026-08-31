"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis, LogOut, Upload, UserRound } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { APP_ROOT, SLATE_HOSTED } from "@/lib/public-mode";
import { cn } from "@/lib/utils";

export function OwnedAppToolbar({
  id,
  center,
  actions,
  position = "sticky",
  ariaLabel = "App controls",
  className,
}: {
  id: string;
  center: React.ReactNode;
  actions: React.ReactNode;
  position?: "sticky" | "fixed";
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <header
      id={id}
      aria-label={ariaLabel}
      className={cn(
        "pointer-events-none inset-x-0 top-0 z-50 shrink-0 px-2.5 pb-7 text-foreground min-[380px]:px-3 md:px-5 md:pb-6 lg:px-8 xl:px-10",
        position === "fixed" ? "fixed" : "sticky",
        className,
      )}
      style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
    >
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, hsl(var(--background) / 0.98) 0%, hsl(var(--background) / 0.9) 54%, hsl(var(--background) / 0.54) 76%, hsl(var(--background) / 0) 100%)",
          }}
        />
        <div
          className="absolute inset-0 backdrop-blur-2xl"
          style={{
            WebkitMaskImage:
              "linear-gradient(to bottom, black 0%, black 48%, rgba(0,0,0,0.72) 68%, transparent 100%)",
            maskImage:
              "linear-gradient(to bottom, black 0%, black 48%, rgba(0,0,0,0.72) 68%, transparent 100%)",
          }}
        />
      </div>

      <div className="pointer-events-auto grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-x-1.5 lg:gap-x-2.5 xl:gap-x-3">
        <Link
          href={APP_ROOT}
          prefetch
          aria-label="slate home"
          className="col-start-1 row-start-1 inline-flex items-center pl-0.5 outline-none transition-opacity hover:opacity-82 focus-visible:ring-1 focus-visible:ring-primary/60"
        >
          <Image
            src="/brand/logo-light.svg"
            alt="slate"
            width={62}
            height={17}
            loading="eager"
            className="hidden dark:block"
          />
          <Image
            src="/brand/logo-dark.svg"
            alt="slate"
            width={62}
            height={17}
            loading="eager"
            className="dark:hidden"
          />
        </Link>

        {center}

        <div className="col-start-2 row-start-1 flex shrink-0 items-center justify-end gap-1 md:col-start-3 md:gap-1 lg:gap-2 xl:justify-self-end">
          {actions}
        </div>
      </div>
    </header>
  );
}

export function OwnerMenu({
  avatarUrl,
  displayName,
}: {
  avatarUrl: string | null;
  displayName: string;
}) {
  const pathname = usePathname();
  const profileActive = pathname.startsWith("/profile");

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Open profile menu"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-foreground/[0.055] text-muted-foreground transition-[border-color,background-color,color,transform] duration-150 hover:border-foreground/20 hover:bg-foreground/[0.09] hover:text-foreground active:scale-[0.97]"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover md:hidden"
            />
          ) : (
            <span className="grid h-full w-full place-items-center text-xs font-semibold text-foreground/75 md:hidden">
              {displayName.slice(0, 1).toLocaleUpperCase()}
            </span>
          )}
          <Ellipsis className="hidden h-4 w-4 md:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="z-[90] w-48 border-border bg-popover/96 p-1.5 text-popover-foreground shadow-[0_24px_70px_-24px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
      >
        <DropdownMenuItem asChild className="gap-2 rounded-lg focus:bg-accent">
          <Link href="/import">
            <Upload className="h-3.5 w-3.5 text-muted-foreground" />
            Import
          </Link>
        </DropdownMenuItem>
        {SLATE_HOSTED ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              asChild
              className={cn(
                "gap-2 rounded-lg focus:bg-accent",
                profileActive && "bg-accent text-foreground",
              )}
            >
              <Link
                href="/profile"
                aria-current={profileActive ? "page" : undefined}
              >
                <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <form action={signOutAction}>
              <DropdownMenuItem
                asChild
                className="gap-2 rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <button type="submit" className="w-full">
                  <LogOut className="h-3.5 w-3.5 text-current opacity-75" />
                  Sign out
                </button>
              </DropdownMenuItem>
            </form>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
