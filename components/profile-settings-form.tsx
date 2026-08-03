"use client";

import { useActionState, useEffect, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Globe2,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import {
  updateProfile,
  type ProfileActionState,
} from "@/lib/profile-actions";
import { cn } from "@/lib/utils";

export function ProfileSettingsForm({
  displayName,
  username,
  isPublic,
  origin,
}: {
  displayName: string;
  username: string;
  isPublic: boolean;
  origin: string;
}) {
  const [state, action, pending] = useActionState(updateProfile, {
    ok: false,
    message: "",
    displayName,
    username,
    isPublic,
  } satisfies ProfileActionState);
  const [copied, setCopied] = useState(false);
  const savedDisplayName = state.displayName ?? displayName;
  const savedUsername = state.username ?? username;
  const savedPublic = state.isPublic ?? isPublic;
  const [draftDisplayName, setDraftDisplayName] = useState(displayName);
  const [draftUsername, setDraftUsername] = useState(savedUsername);
  const [publicEnabled, setPublicEnabled] = useState(savedPublic);
  const publicUrl = `${origin}/u/${savedUsername}`;
  const displayOrigin = origin.replace(/^https?:\/\/(?:www\.)?/, "");
  const draftPublicUrl = `${displayOrigin}/u/${draftUsername || "username"}`;
  const hasChanges =
    draftDisplayName !== savedDisplayName ||
    draftUsername !== savedUsername ||
    publicEnabled !== savedPublic;

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  async function copyLink() {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <form action={action} className="space-y-5">
      <section className="rounded-[1.5rem] border border-border/70 bg-card/55 p-5 shadow-[0_22px_70px_-58px_hsl(var(--foreground)/0.42)] sm:p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Identity</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              The name and address friends will recognize.
            </p>
          </div>
          <span className="pt-1 font-mono text-[10px] tracking-[0.16em] text-muted-foreground/60">
            01
          </span>
        </header>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="display-name"
              className="text-xs font-medium text-foreground"
            >
              Display name
            </label>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              Shown at the top of your shared profile.
            </p>
            <input
              id="display-name"
              name="displayName"
              value={draftDisplayName}
              onChange={(event) => setDraftDisplayName(event.target.value)}
              onBlur={(event) =>
                setDraftDisplayName(
                  event.target.value.replace(/\s+/g, " ").trim()
                )
              }
              minLength={2}
              maxLength={60}
              required
              autoComplete="name"
              className="mt-3 h-12 w-full rounded-xl border border-border bg-background/55 px-3.5 text-sm font-medium outline-none transition-[border-color,box-shadow,background-color] focus:border-primary/60 focus:bg-background focus:ring-2 focus:ring-primary/15"
            />
          </div>

          <div>
            <label
              htmlFor="username"
              className="text-xs font-medium text-foreground"
            >
              Username
            </label>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              Lowercase letters, numbers, and hyphens.
            </p>
            <div className="relative mt-3">
              <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center font-mono text-sm text-muted-foreground">
                @
              </span>
              <input
                id="username"
                name="username"
                value={draftUsername}
                onChange={(event) =>
                  setDraftUsername(
                    event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                  )
                }
                minLength={3}
                maxLength={30}
                pattern="[a-z0-9][a-z0-9-]{2,29}"
                required
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="h-12 w-full rounded-xl border border-border bg-background/55 pr-3.5 pl-8 font-mono text-sm outline-none transition-[border-color,box-shadow,background-color] focus:border-primary/60 focus:bg-background focus:ring-2 focus:ring-primary/15"
              />
            </div>
          </div>
        </div>

        <div className="mt-5 border-t border-border/70 pt-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.13em] text-muted-foreground">
            Profile address
          </p>
          <p className="mt-1.5 truncate font-mono text-[11px] text-foreground/75">
            {draftPublicUrl}
          </p>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-border/70 bg-card/55 p-5 shadow-[0_22px_70px_-58px_hsl(var(--foreground)/0.42)] sm:p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Sharing</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Decide whether friends can browse your shelves.
            </p>
          </div>
          <span className="pt-1 font-mono text-[10px] tracking-[0.16em] text-muted-foreground/60">
            02
          </span>
        </header>

        <label className="mt-6 flex cursor-pointer items-center gap-3 border-y border-border/70 py-5 sm:gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background text-muted-foreground">
            {publicEnabled ? (
              <Globe2 className="h-[18px] w-[18px] text-primary" />
            ) : (
              <Lock className="h-[18px] w-[18px]" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">
              {publicEnabled ? "Public profile" : "Private profile"}
            </span>
            <span className="mt-1 block text-[11px] leading-5 text-muted-foreground sm:text-xs">
              {publicEnabled
                ? "Anyone with your link can browse Watchlist, Watching, and Watched."
                : "Your shelves are visible only to you."}
            </span>
          </span>
          <span className="relative inline-flex shrink-0">
            <input
              type="checkbox"
              name="isPublic"
              checked={publicEnabled}
              onChange={(event) => setPublicEnabled(event.target.checked)}
              className="peer sr-only"
            />
            <span className="h-6 w-10 rounded-full bg-muted shadow-inner transition-colors duration-200 peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background" />
            <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 peer-checked:translate-x-4" />
          </span>
        </label>

        <div className="mt-5">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium">Public link</p>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                {savedPublic
                  ? publicEnabled
                    ? "Your saved link is live."
                    : "This link stays live until you save your changes."
                  : publicEnabled
                    ? "Save your changes to make this link live."
                    : "Publish your profile to create a shareable link."}
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_2.75rem] gap-2">
            <button
              type="button"
              onClick={copyLink}
              disabled={!savedPublic}
              aria-label={copied ? "Public profile link copied" : "Copy public profile link"}
              className={cn(
                "inline-flex h-11 min-w-0 items-center justify-start gap-2 rounded-xl border border-border bg-background/45 px-3.5 text-left text-xs font-medium transition-[background-color,border-color,transform] active:scale-[0.99]",
                savedPublic
                  ? "hover:border-primary/30 hover:bg-background"
                  : "cursor-not-allowed text-muted-foreground opacity-45"
              )}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-success" />
              ) : (
                <Copy className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="min-w-0 truncate font-mono text-[11px]">
                {savedPublic
                  ? copied
                    ? "Link copied"
                    : publicUrl.replace(/^https?:\/\/(?:www\.)?/, "")
                  : "No public link yet"}
              </span>
            </button>
            {savedPublic ? (
              <a
                href={`/u/${savedUsername}`}
                target="_blank"
                rel="noreferrer"
                aria-label="Open public profile"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background/45 transition-[background-color,border-color,transform] hover:border-primary/30 hover:bg-background active:scale-[0.97]"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : (
              <span
                aria-hidden
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background/25 text-muted-foreground opacity-45"
              >
                <Lock className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] text-muted-foreground" aria-live="polite">
          {pending
            ? "Saving your changes…"
            : hasChanges
              ? "You have unsaved changes."
              : "Everything is up to date."}
        </p>
        <button
          type="submit"
          disabled={pending || !hasChanges}
          className={cn(
            "inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-[background-color,border-color,color,opacity,transform] active:scale-[0.98] disabled:cursor-default sm:w-auto",
            hasChanges || pending
              ? "bg-foreground text-background"
              : "border border-border/80 bg-transparent text-muted-foreground"
          )}
        >
          {!pending && !hasChanges ? <Check className="h-4 w-4" /> : null}
          {pending ? "Saving…" : hasChanges ? "Save changes" : "Saved"}
        </button>
      </div>
    </form>
  );
}
