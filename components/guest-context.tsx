"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { captureAnalytics } from "@/lib/analytics";
import { guestSignupPath } from "@/lib/guest-id";
import { cn } from "@/lib/utils";

/**
 * What a guest can't do without an account, each with the reason we give.
 * Everything else (saving, lists, ratings, Discover, Previews) just works.
 */
export const SIGNUP_REASONS = {
  share: {
    title: "Sign up to share your lists",
    body: "Sharing sends people a link to a slate that lives in an account. Sign up and everything you saved comes with you.",
  },
  profile: {
    title: "Sign up for your own profile",
    body: "A profile gives your slate a name and a link you can share. Everything you saved as a guest comes with you.",
  },
  invite: {
    title: "Sign up to plan with friends",
    body: "Shared lists keep everyone's picks in one place, and need an account for each person on them.",
  },
  tv: {
    title: "Sign up to watch on your TV",
    body: "Your TV opens your slate by signing in, so it needs an account. Everything you saved comes with you.",
  },
  ai: {
    title: "Sign up to keep asking",
    body: "You've used the questions guests get. Sign up for more, and keep everything you saved.",
  },
  save: {
    title: "Keep your slate",
    body: "Right now your slate lives only in this browser. Sign up to keep it and use it on your phone and TV.",
  },
} as const;

export type SignupReason = keyof typeof SIGNUP_REASONS;

interface GuestContextValue {
  isGuest: boolean;
  /** Open the sign-up sheet. Does nothing for an account. */
  askToSignUp: (reason: SignupReason) => void;
}

const GuestContext = React.createContext<GuestContextValue>({
  isGuest: false,
  askToSignUp: () => undefined,
});

export function useGuest() {
  return React.useContext(GuestContext);
}

/** Where sign-up should bring the person back to: the page they're on. */
export function useSignupHref() {
  return guestSignupPath(usePathname());
}

const buttonBase =
  "inline-flex h-11 w-full items-center justify-center whitespace-nowrap rounded-full px-4 text-sm font-medium transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:h-10";

export function GuestProvider({
  isGuest,
  children,
}: {
  isGuest: boolean;
  children: React.ReactNode;
}) {
  const [reason, setReason] = React.useState<SignupReason | null>(null);
  const [lastReason, setLastReason] = React.useState<SignupReason>("save");
  const askToSignUp = React.useCallback(
    (next: SignupReason) => {
      if (!isGuest) return;
      setReason(next);
      setLastReason(next);
      captureAnalytics("guest_signup_prompted", { reason: next });
    },
    [isGuest],
  );
  const value = React.useMemo(() => ({ isGuest, askToSignUp }), [askToSignUp, isGuest]);
  const copy = SIGNUP_REASONS[reason ?? lastReason];

  return (
    <GuestContext.Provider value={value}>
      {children}
      {isGuest ? (
        <Dialog open={reason !== null} onOpenChange={(open) => !open && setReason(null)}>
          <DialogContent
            size="sm"
            className="gap-0 p-5 pt-6 sm:p-6"
            // Focus the sheet itself, not its first button, so nothing looks
            // pre-chosen when it opens from a tap.
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              (event.currentTarget as HTMLElement | null)?.focus();
            }}
          >
            <DialogTitle className="pr-8 text-lg leading-snug">{copy.title}</DialogTitle>
            <DialogDescription className="mt-2 leading-6">{copy.body}</DialogDescription>
            <SignupActions
              className="mt-5"
              analyticsArea={`guest_gate_${reason ?? lastReason}`}
              onNotNow={() => setReason(null)}
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </GuestContext.Provider>
  );
}

/**
 * Sign up, and "Not now" when there is no close button to do that job. One
 * row: equal widths on a phone, their own width from `sm` up.
 */
export function SignupActions({
  className,
  analyticsArea,
  onNotNow,
}: {
  className?: string;
  analyticsArea: string;
  onNotNow?: () => void;
}) {
  const href = useSignupHref();
  return (
    <div className={cn("grid gap-2 sm:flex sm:items-center", onNotNow ? "grid-cols-2" : "grid-cols-1", className)}>
      <Link
        href={href}
        className={cn(buttonBase, "bg-primary text-primary-foreground sm:w-auto")}
        data-analytics-action="guest_signup"
        data-analytics-area={analyticsArea}
      >
        Sign up free
      </Link>
      {onNotNow ? (
        <button
          type="button"
          onClick={onNotNow}
          className={cn(
            buttonBase,
            "border border-border bg-foreground/[0.055] text-foreground hover:bg-foreground/[0.09] sm:w-auto",
          )}
        >
          Not now
        </button>
      ) : null}
    </div>
  );
}

/**
 * Wrap a control that needs an account. For a guest, pressing it opens the
 * sign-up sheet instead (the press is stopped before the control sees it);
 * for an account, the control works as usual.
 */
export function SignupGate({
  reason,
  children,
  className,
}: {
  reason: SignupReason;
  children: React.ReactNode;
  className?: string;
}) {
  const { isGuest, askToSignUp } = useGuest();
  if (!isGuest) return <>{children}</>;
  const stop = (event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };
  return (
    <span
      className={cn("contents", className)}
      onPointerDownCapture={stop}
      onKeyDownCapture={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          stop(event);
          askToSignUp(reason);
        }
      }}
      onClickCapture={(event) => {
        stop(event);
        askToSignUp(reason);
      }}
    >
      {children}
    </span>
  );
}
