"use client";

import { useActionState, useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Globe2, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  updateProfile,
  type ProfileActionState,
} from "@/lib/profile-actions";
import { cn } from "@/lib/utils";

const INITIAL: ProfileActionState = { ok: false, message: "" };

export function ProfileSettingsForm({
  username,
  isPublic,
  origin,
}: {
  username: string;
  isPublic: boolean;
  origin: string;
}) {
  const [state, action, pending] = useActionState(updateProfile, INITIAL);
  const [copied, setCopied] = useState(false);
  const currentUsername = state.ok && state.username ? state.username : username;
  const currentPublic =
    state.ok && typeof state.isPublic === "boolean" ? state.isPublic : isPublic;
  const publicUrl = `${origin}/u/${currentUsername}`;
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
    <form action={action} className="mt-8 space-y-6">
      <div>
        <label htmlFor="username" className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Profile URL
        </label>
        <div className="mt-2 flex items-center rounded-xl border border-border bg-background/60 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15">
          <span className="shrink-0 pl-3 text-sm text-muted-foreground">
            {publicPrefix}
          </span>
          <input
            id="username"
            name="username"
            defaultValue={currentUsername}
            minLength={3}
            maxLength={30}
            pattern="[a-z0-9][a-z0-9-]{2,29}"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="h-11 min-w-0 flex-1 bg-transparent px-1 pr-3 text-sm outline-none"
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-start justify-between gap-5 rounded-2xl border border-border bg-background/50 p-4">
        <span className="flex gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {currentPublic ? <Globe2 className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          </span>
          <span>
            <span className="block text-sm font-medium">Public library</span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
              Anyone with your link can browse your Watchlist, Watching, and Watched shelves.
            </span>
          </span>
        </span>
        <span className="relative mt-1 inline-flex">
          <input
            type="checkbox"
            name="isPublic"
            defaultChecked={currentPublic}
            className="peer sr-only"
          />
          <span className="h-6 w-10 rounded-full bg-muted transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background" />
          <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
        </span>
      </label>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-opacity disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save profile"}
        </button>
        <button
          type="button"
          onClick={copyLink}
          disabled={!currentPublic}
          className={cn(
            "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border px-5 text-sm font-medium transition-colors",
            currentPublic
              ? "hover:bg-accent"
              : "cursor-not-allowed text-muted-foreground opacity-50"
          )}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy public link"}
        </button>
        {currentPublic && (
          <a
            href={`/u/${currentUsername}`}
            target="_blank"
            rel="noreferrer"
            aria-label="Open public profile"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border transition-colors hover:bg-accent"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
    </form>
  );
}
