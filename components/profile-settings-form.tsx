"use client";

import { useActionState, useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Globe2, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  updateProfile,
  type ProfileActionState,
} from "@/lib/profile-actions";
import { ProfileAvatarEditor } from "@/components/profile-avatar-editor";
import { cn } from "@/lib/utils";

export function ProfileSettingsForm({
  displayName,
  username,
  isPublic,
  origin,
  avatarUrl,
}: {
  displayName: string;
  username: string;
  isPublic: boolean;
  origin: string;
  avatarUrl: string | null;
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
      <section className="rounded-[1.75rem] border border-border/70 bg-card/55 p-5 shadow-[0_24px_80px_-62px_hsl(var(--foreground)/0.5)] sm:p-7">
        <div className="flex items-center gap-4 sm:gap-6">
          <ProfileAvatarEditor
            avatarUrl={avatarUrl}
            displayName={draftDisplayName || displayName}
          />

          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-center gap-2">
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  publicEnabled ? "bg-success" : "bg-muted-foreground/55"
                )}
                aria-hidden
              />
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {publicEnabled ? "Public" : "Private"}
              </span>
            </div>

            <label htmlFor="display-name" className="sr-only">
              Display name
            </label>
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
              aria-label="Display name"
              className="-mx-2 block h-10 w-[calc(100%+1rem)] truncate rounded-lg border border-transparent bg-transparent px-2 text-[1.65rem] font-semibold leading-none tracking-[-0.045em] outline-none transition-[border-color,background-color,box-shadow] hover:bg-background/35 focus:border-border/80 focus:bg-background/65 focus:ring-2 focus:ring-primary/10 sm:h-12 sm:text-[2rem]"
            />

            <label htmlFor="username" className="sr-only">
              Username
            </label>
            <div className="-mx-2 mt-0.5 flex h-8 max-w-full items-center rounded-lg border border-transparent px-2 text-muted-foreground transition-[border-color,background-color,box-shadow] focus-within:border-border/80 focus-within:bg-background/65 focus-within:ring-2 focus-within:ring-primary/10 hover:bg-background/35 sm:mt-1">
              <span className="shrink-0 font-mono text-sm" aria-hidden>
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
                aria-label="Username"
                className="min-w-0 flex-1 bg-transparent font-mono text-sm text-muted-foreground outline-none"
              />
            </div>
          </div>
        </div>

      </section>

      <section className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-card/45">
        <label className="flex cursor-pointer items-center gap-3 p-5 sm:gap-4 sm:p-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background/70 text-muted-foreground">
            {publicEnabled ? (
              <Globe2 className="h-[18px] w-[18px] text-primary" />
            ) : (
              <Lock className="h-[18px] w-[18px]" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">
              Share your slate
            </span>
            <span className="mt-1 block text-[11px] leading-5 text-muted-foreground sm:text-xs">
              {publicEnabled
                ? "Anyone with the link can browse your shelves."
                : "Only you can see your shelves."}
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

        <div className="border-t border-border/60 p-3 sm:p-4">
          <div className="grid grid-cols-[minmax(0,1fr)_2.75rem] gap-2">
            <button
              type="button"
              onClick={copyLink}
              disabled={!savedPublic}
              aria-label={
                copied ? "Public profile link copied" : "Copy public profile link"
              }
              className={cn(
                "inline-flex h-11 min-w-0 items-center justify-start gap-2 rounded-xl bg-background/55 px-3.5 text-left text-xs font-medium transition-[background-color,opacity,transform] active:scale-[0.99]",
                savedPublic
                  ? "hover:bg-background"
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
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-background/55 transition-[background-color,transform] hover:bg-background active:scale-[0.97]"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : (
              <span
                aria-hidden
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-background/25 text-muted-foreground opacity-45"
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
