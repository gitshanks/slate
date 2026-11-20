import * as React from "react";
import Link from "next/link";
import { ChevronRight, LogOut } from "lucide-react";
import { PrivacyPreferencesButton } from "@/components/analytics/privacy-preferences-button";
import { DeleteAccountSettings } from "@/components/delete-account-settings";
import { ProfileAppearance } from "@/components/profile-appearance";
import { ProfileSettingsForm } from "@/components/profile-settings-form";
import { SignupActions } from "@/components/guest-context";
import {
  SettingsGroup,
  SettingsRow,
  settingsButtonClass,
  settingsLinkClass,
  settingsRowClass,
} from "@/components/settings-group";
import { APP_ROOT } from "@/lib/public-mode";
import { cn } from "@/lib/utils";

export interface ProfileShelfCounts {
  upNext: number;
  watching: number;
  watched: number;
}

function shelvesNav(shelves: { label: string; value: number; href: string }[]) {
  return (
    <nav
      aria-label="Your shelves"
      className="profile-rise grid grid-cols-3 border-y border-border/60"
      style={{ "--i": 1 } as React.CSSProperties}
    >
      {shelves.map((shelf, index) => (
        <Link
          key={shelf.label}
          href={shelf.href}
          className={cn(
            "group flex flex-col gap-1.5 py-5 outline-none transition-colors duration-150 focus-visible:bg-accent/60 sm:py-6",
            index > 0 && "border-l border-border/60 pl-4 sm:pl-6",
          )}
        >
          <span className="text-[1.75rem] font-semibold leading-none tracking-[-0.04em] tabular-nums sm:text-[2.25rem]">
            {shelf.value.toLocaleString("en-US")}
          </span>
          <span className="flex items-center gap-0.5 text-[13px] text-muted-foreground transition-colors duration-150 group-hover:text-foreground">
            {shelf.label}
            <ChevronRight
              aria-hidden
              className="h-3.5 w-3.5 opacity-0 transition-[opacity,transform] duration-150 ease-[var(--ease-ui-out)] group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-visible:opacity-100"
            />
          </span>
        </Link>
      ))}
    </nav>
  );
}

export function ProfileScreen({
  displayName,
  username,
  isPublic,
  origin,
  avatarUrl,
  email,
  joined,
  counts,
  isAdmin,
  signOutAction,
  isGuest = false,
}: {
  /** A guest has no profile to edit yet: the screen asks them to sign up. */
  isGuest?: boolean;
  displayName: string;
  username: string;
  isPublic: boolean;
  origin: string;
  avatarUrl: string | null;
  email: string | null;
  /** Already formatted, e.g. "March 2025". */
  joined: string | null;
  counts: ProfileShelfCounts | null;
  isAdmin: boolean;
  signOutAction: () => Promise<void>;
}) {
  const shelves = counts
    ? [
        { label: "Up next", value: counts.upNext, href: APP_ROOT },
        { label: "Watching", value: counts.watching, href: "/watching" },
        { label: "Watched", value: counts.watched, href: "/watched" },
      ]
    : null;

  return (
    <div className="mx-auto w-full max-w-2xl pb-6 sm:pb-10">
      <h1 className="sr-only">Profile</h1>

      {isGuest ? (
        <section
          aria-labelledby="guest-profile-heading"
          className="profile-rise rounded-2xl border border-border bg-card/60 p-5 sm:p-6"
          style={{ "--i": 0 } as React.CSSProperties}
        >
          <h2 id="guest-profile-heading" className="text-balance text-xl font-semibold tracking-tight">
            You&apos;re using Slate as a guest
          </h2>
          <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">
            Your slate lives only in this browser for now. Sign up free to keep it, get a profile you can share, and open it on your phone, computer and iPad. Everything you saved comes with you.
          </p>
          <SignupActions className="mt-5" analyticsArea="profile_guest" />
          {shelves ? <div className="mt-6">{shelvesNav(shelves)}</div> : null}
        </section>
      ) : (
        <ProfileSettingsForm
          displayName={displayName}
          username={username}
          isPublic={isPublic}
          origin={origin}
          avatarUrl={avatarUrl}
          joined={joined}
          shelves={shelves ? shelvesNav(shelves) : null}
        />
      )}

      <div className="mt-9 space-y-9">
        <ProfileAppearance index={3} />

        <SettingsGroup label="Account" index={4}>
          {isAdmin ? (
            <Link
              href="/admin"
              className={cn(
                settingsRowClass,
                "group outline-none transition-colors duration-150 hover:bg-accent/50 focus-visible:bg-accent/60",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium leading-tight">
                  Insights
                </span>
                <span className="mt-1 block text-[13px] leading-snug text-muted-foreground">
                  Signups, usage and what people watch. Only admins see this.
                </span>
              </span>
              <ChevronRight
                aria-hidden
                className="h-4 w-4 shrink-0 text-muted-foreground transition-[transform,color] duration-150 ease-[var(--ease-ui-out)] group-hover:translate-x-0.5 group-hover:text-foreground"
              />
            </Link>
          ) : null}
          <SettingsRow
            title="Data and privacy"
            description="Review what slate collects or change optional analytics."
            className="flex-wrap"
          >
            <Link href="/privacy" className={settingsLinkClass}>
              Read details
            </Link>
            <PrivacyPreferencesButton compact />
          </SettingsRow>
          {isGuest ? null : (
            <SettingsRow
              title="Signed in"
              description={email ?? "This device is signed in to your account."}
            >
              <form
                action={signOutAction}
                data-analytics-reset="true"
                data-analytics-form="sign_out"
              >
                <button type="submit" className={settingsButtonClass}>
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </form>
            </SettingsRow>
          )}
        </SettingsGroup>

        {isGuest ? null : (
          <SettingsGroup index={5}>
            <DeleteAccountSettings />
          </SettingsGroup>
        )}
      </div>
    </div>
  );
}
