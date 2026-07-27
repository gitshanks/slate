"use client";

import { useActionState, useEffect, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Globe2,
  Link2,
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
  const savedUsername = state.username ?? username;
  const savedPublic = state.isPublic ?? isPublic;
  const [draftDisplayName, setDraftDisplayName] = useState(displayName);
  const [draftUsername, setDraftUsername] = useState(savedUsername);
  const [publicEnabled, setPublicEnabled] = useState(savedPublic);
  const publicUrl = `${origin}/u/${savedUsername}`;
  const publicPrefix = `${origin.replace(/^https?:\/\//, "")}/u/`;

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
    <form action={action} className="mt-7 space-y-7">
      <div>
        <label
          htmlFor="display-name"
          className="text-xs font-medium text-foreground"
        >
          Display name
        </label>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          This is the name friends see on your shared slate.
        </p>
        <input
          id="display-name"
          name="displayName"
          value={draftDisplayName}
          onChange={(event) => setDraftDisplayName(event.target.value)}
          minLength={2}
          maxLength={60}
          required
          autoComplete="name"
          className="mt-3 h-12 w-full rounded-2xl border border-border bg-background/60 px-3 text-sm font-medium outline-none transition-[border-color,box-shadow] focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
        />
      </div>

      <div>
        <label
          htmlFor="username"
          className="text-xs font-medium text-foreground"
        >
          Profile URL
        </label>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Pick a short, memorable address for your library.
        </p>
        <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-background/60 transition-[border-color,box-shadow] focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15 sm:flex sm:items-center">
          <span className="flex h-10 items-center gap-2 border-b border-border/70 bg-muted/45 px-3 font-mono text-[11px] text-muted-foreground sm:h-12 sm:shrink-0 sm:border-r sm:border-b-0">
            <Link2 className="h-3.5 w-3.5" aria-hidden />
            {publicPrefix}
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
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="h-12 w-full min-w-0 bg-transparent px-3 font-mono text-sm outline-none sm:flex-1"
          />
        </div>
      </div>

      <label className="grid cursor-pointer grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-3 rounded-2xl border border-border bg-background/50 p-4 transition-colors hover:bg-background/80 min-[360px]:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {publicEnabled ? (
            <Globe2 className="h-[18px] w-[18px]" />
          ) : (
            <Lock className="h-[18px] w-[18px]" />
          )}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium">
            {publicEnabled ? "Public library" : "Private library"}
          </span>
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
            {publicEnabled
              ? "Anyone with your link can browse your three main shelves."
              : "Only you can see your Watchlist, Watching, and Watched shelves."}
          </span>
        </span>
        <span className="relative col-start-2 mt-1 inline-flex w-fit min-[360px]:col-start-auto min-[360px]:mt-2">
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

      <div className="border-t border-border/70 pt-5">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-[opacity,transform] active:scale-[0.99] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save profile"}
        </button>

        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_3rem] gap-2">
          <button
            type="button"
            onClick={copyLink}
            disabled={!savedPublic}
            className={cn(
              "inline-flex h-12 min-w-0 items-center justify-center gap-2 rounded-full border border-border px-4 text-sm font-medium transition-colors",
              savedPublic
                ? "hover:bg-accent"
                : "cursor-not-allowed text-muted-foreground opacity-45"
            )}
          >
            {copied ? (
              <Check className="h-4 w-4 shrink-0" />
            ) : (
              <Copy className="h-4 w-4 shrink-0" />
            )}
            <span className="truncate">
              {savedPublic
                ? copied
                  ? "Link copied"
                  : "Copy public link"
                : "Publish to share"}
            </span>
          </button>
          {savedPublic ? (
            <a
              href={`/u/${savedUsername}`}
              target="_blank"
              rel="noreferrer"
              aria-label="Open public profile"
              className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-border transition-colors hover:bg-accent"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : (
            <span
              aria-hidden
              className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-border text-muted-foreground opacity-45"
            >
              <Lock className="h-4 w-4" />
            </span>
          )}
        </div>
      </div>
    </form>
  );
}
