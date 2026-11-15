"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Globe2,
  LoaderCircle,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import {
  updateProfile,
  type ProfileActionState,
} from "@/lib/profile-actions";
import { ProfileAvatarEditor } from "@/components/profile-avatar-editor";
import {
  SettingsGroup,
  settingsButtonClass,
  settingsRowClass,
} from "@/components/settings-group";
import { cn } from "@/lib/utils";
import { captureAnalytics } from "@/lib/analytics";

const USERNAME = /^[a-z0-9][a-z0-9-]{2,29}$/;

function normalizeDisplayName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function ProfileSettingsForm({
  displayName,
  username,
  isPublic,
  origin,
  avatarUrl,
  joined,
  shelves,
}: {
  displayName: string;
  username: string;
  isPublic: boolean;
  origin: string;
  avatarUrl: string | null;
  joined: string | null;
  /** Rendered between the identity and the sharing settings. */
  shelves?: React.ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const lastAttemptRef = useRef("");
  const lastTrackedAttemptRef = useRef("");
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
  const normalizedDisplayName = normalizeDisplayName(draftDisplayName);
  const publicUrl = `${origin}/u/${savedUsername}`;
  const hasChanges =
    normalizedDisplayName !== savedDisplayName ||
    draftUsername !== savedUsername ||
    publicEnabled !== savedPublic;
  const draftIsValid =
    normalizedDisplayName.length >= 2 &&
    normalizedDisplayName.length <= 60 &&
    USERNAME.test(draftUsername);
  const draftSnapshot = JSON.stringify([
    normalizedDisplayName,
    draftUsername,
    publicEnabled,
  ]);
  const savedSnapshot = JSON.stringify([
    savedDisplayName,
    savedUsername,
    savedPublic,
  ]);
  const saveFailed =
    Boolean(state.message) &&
    !state.ok &&
    state.attemptSnapshot === draftSnapshot;

  useEffect(() => {
    if (!state.message) return;
    if (!state.ok) toast.error(state.message);
    if (
      state.ok &&
      state.attemptSnapshot &&
      lastTrackedAttemptRef.current !== state.attemptSnapshot
    ) {
      lastTrackedAttemptRef.current = state.attemptSnapshot;
      captureAnalytics("profile_updated", {
        public_profile: state.isPublic ?? false,
      });
    }
  }, [state]);

  useEffect(() => {
    if (
      !draftIsValid ||
      draftSnapshot === savedSnapshot ||
      draftSnapshot === lastAttemptRef.current
    ) {
      return;
    }

    const delay = publicEnabled !== savedPublic ? 0 : 650;
    const timeout = window.setTimeout(() => {
      const form = formRef.current;
      if (!form || !form.checkValidity()) return;
      lastAttemptRef.current = draftSnapshot;
      form.requestSubmit();
    }, delay);

    return () => window.clearTimeout(timeout);
  }, [
    draftIsValid,
    draftSnapshot,
    publicEnabled,
    savedPublic,
    savedSnapshot,
  ]);

  function requestSave(
    form: HTMLFormElement | null,
    snapshot: string,
    valid = draftIsValid
  ) {
    if (
      !valid ||
      !form ||
      snapshot === savedSnapshot ||
      snapshot === lastAttemptRef.current ||
      !form.checkValidity()
    ) {
      return;
    }

    lastAttemptRef.current = snapshot;
    form.requestSubmit();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      captureAnalytics("profile_link_copied", { public_profile: savedPublic });
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
      toast.error("Couldn't copy the link. Open your profile to copy its address.");
    }
  }

  const status = pending
    ? "Saving…"
    : !hasChanges
      ? null
      : !draftIsValid
        ? "Finish editing"
        : saveFailed
          ? "Couldn't save"
          : "Saving…";
  const field =
    "rounded-xl border border-transparent transition-[border-color,background-color,box-shadow] duration-150 hover:bg-foreground/[0.045] focus-within:border-border focus-within:bg-card focus-within:ring-4 focus-within:ring-primary/10";

  return (
    <form
      ref={formRef}
      action={action}
      className="space-y-9"
      data-analytics-form="profile_settings"
      data-analytics-private
    >
      <section
        className="profile-rise flex items-center gap-5 pt-1 sm:gap-7 sm:pt-3"
        style={{ "--i": 0 } as React.CSSProperties}
      >
        <ProfileAvatarEditor
          avatarUrl={avatarUrl}
          displayName={draftDisplayName || displayName}
        />

        <div className="min-w-0 flex-1">
          <label htmlFor="display-name" className="sr-only">
            Display name
          </label>
          <div className={cn(field, "-mx-2.5")}>
            <input
              id="display-name"
              name="displayName"
              value={draftDisplayName}
              onChange={(event) => setDraftDisplayName(event.target.value)}
              onBlur={(event) => {
                const nextDisplayName = normalizeDisplayName(event.target.value);
                const valid =
                  nextDisplayName.length >= 2 &&
                  nextDisplayName.length <= 60 &&
                  USERNAME.test(draftUsername);
                const snapshot = JSON.stringify([
                  nextDisplayName,
                  draftUsername,
                  publicEnabled,
                ]);
                setDraftDisplayName(nextDisplayName);
                requestSave(event.currentTarget.form, snapshot, valid);
              }}
              minLength={2}
              maxLength={60}
              required
              autoComplete="name"
              aria-label="Display name"
              className="block h-11 w-full truncate bg-transparent px-2.5 text-[1.75rem] font-semibold leading-none tracking-[-0.045em] outline-none sm:h-14 sm:text-[2.5rem]"
            />
          </div>

          <label htmlFor="username" className="sr-only">
            Username
          </label>
          <div
            className={cn(
              field,
              "-mx-2.5 mt-0.5 flex h-9 items-center px-2.5 text-muted-foreground",
            )}
          >
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
              onBlur={(event) => {
                const nextUsername = event.currentTarget.value;
                const valid =
                  normalizedDisplayName.length >= 2 &&
                  normalizedDisplayName.length <= 60 &&
                  USERNAME.test(nextUsername);
                const snapshot = JSON.stringify([
                  normalizedDisplayName,
                  nextUsername,
                  publicEnabled,
                ]);
                requestSave(event.currentTarget.form, snapshot, valid);
              }}
              minLength={3}
              maxLength={30}
              pattern="[a-z0-9][a-z0-9-]{2,29}"
              required
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Username"
              className="min-w-0 flex-1 bg-transparent font-mono text-sm text-muted-foreground outline-none focus:text-foreground"
            />
          </div>

          <p className="mt-2 flex min-h-5 flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              {publicEnabled ? (
                <Globe2 className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Lock className="h-3.5 w-3.5" aria-hidden />
              )}
              {publicEnabled ? "Public" : "Private"}
            </span>
            {joined ? <span>Joined {joined}</span> : null}
            {status ? (
              <span
                className="inline-flex items-center gap-1.5"
                aria-live="polite"
              >
                {status === "Saving…" ? (
                  <LoaderCircle className="loading-spinner h-3 w-3" />
                ) : null}
                {status}
              </span>
            ) : null}
          </p>
        </div>
      </section>

      {shelves}

      <SettingsGroup label="Sharing" id="profile-sharing" index={2}>
        <label className={cn(settingsRowClass, "cursor-pointer")}>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium leading-tight">
              Public profile
            </span>
            <span className="mt-1 block text-[13px] leading-snug text-muted-foreground">
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
              onChange={(event) => {
                const nextPublic = event.currentTarget.checked;
                const snapshot = JSON.stringify([
                  normalizedDisplayName,
                  draftUsername,
                  nextPublic,
                ]);
                setPublicEnabled(nextPublic);
                requestSave(event.currentTarget.form, snapshot);
              }}
              className="peer sr-only"
            />
            <span className="h-7 w-12 rounded-full bg-foreground/15 transition-colors duration-200 peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background" />
            {/* The thumb is two discs: one crosses quickly and the other
                follows, so it stretches on the way and closes up on arrival. */}
            <span className="absolute left-[3px] top-[3px] h-[22px] w-[22px] rounded-full bg-white transition-transform duration-[320ms] ease-[var(--ease-ui-move)] peer-checked:translate-x-5 peer-active:scale-95 motion-reduce:transition-none" />
            <span className="absolute left-[3px] top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow-sm transition-transform duration-200 ease-[var(--ease-ui-out)] peer-checked:translate-x-5 peer-active:scale-95 motion-reduce:transition-none" />
          </span>
        </label>

        {savedPublic && publicEnabled ? (
          <div className={cn(settingsRowClass, "profile-reveal flex-wrap")}>
            <p className="flex min-w-0 flex-1 basis-full items-center gap-2 text-sm text-muted-foreground sm:basis-0">
              <Globe2 className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">
                {publicUrl.replace(/^https?:\/\/(?:www\.)?/, "")}
              </span>
            </p>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={copyLink}
                disabled={pending}
                aria-label={
                  copied ? "Public profile link copied" : "Copy public profile link"
                }
                className={settingsButtonClass}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                ) : (
                  <Copy className="h-3.5 w-3.5 shrink-0" />
                )}
                <span aria-live="polite">{copied ? "Copied" : "Copy link"}</span>
              </button>
              {pending ? null : (
                <a
                  href={`/u/${savedUsername}`}
                  target="_blank"
                  rel="noreferrer"
                  className={settingsButtonClass}
                >
                  View
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
        ) : null}
      </SettingsGroup>
    </form>
  );
}
