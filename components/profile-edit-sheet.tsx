"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Globe2, LoaderCircle, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProfileAvatarEditor } from "@/components/profile-avatar-editor";
import { saveProfileEdits } from "@/lib/profile-actions";
import type { TastePoster } from "@/lib/profile-taste-core";
import { captureAnalytics } from "@/lib/analytics";
import { backdropUrl, posterUrl } from "@/lib/tmdb-image";
import { cn } from "@/lib/utils";

const USERNAME = /^[a-z0-9][a-z0-9-]{2,29}$/;
const BIO_MAX = 160;

function cleanName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function cleanBio(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Edit profile: everything the profile shows about you, in one sheet that
 * looks like the profile itself. Name, handle, bio and privacy save together
 * with the button; the photo saves as soon as it is picked; the backdrop is
 * one of your Top 4 (choosing it moves that title to first); the Top 4 opens
 * its own picker. Appearance and account live behind "More settings".
 */
export function ProfileEditSheet({
  open,
  onOpenChange,
  displayName,
  username,
  avatarUrl,
  isPublic,
  bio,
  bioSupported,
  top,
  onEditTop,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  isPublic: boolean;
  bio: string | null;
  /** False until the profile_bio migration runs: the field stays hidden. */
  bioSupported: boolean;
  top: TastePoster[];
  onEditTop: () => void;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(displayName);
  const [handle, setHandle] = React.useState(username);
  const [about, setAbout] = React.useState(bio ?? "");
  const [publicOn, setPublicOn] = React.useState(isPublic);
  const [backdropId, setBackdropId] = React.useState(top[0]?.id ?? null);
  const [saving, startSaving] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    setName(displayName);
    setHandle(username);
    setAbout(bio ?? "");
    setPublicOn(isPublic);
    setBackdropId(top[0]?.id ?? null);
    // Start from what's saved each time the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const backdrops = top.filter((poster) => poster.backdropPath);
  const nameClean = cleanName(name);
  const bioClean = cleanBio(about);
  const nameValid = nameClean.length >= 2 && nameClean.length <= 60;
  const handleValid = USERNAME.test(handle);
  const backdropChanged = Boolean(backdropId) && backdropId !== top[0]?.id;
  const changed =
    nameClean !== displayName ||
    handle !== username ||
    publicOn !== isPublic ||
    (bioSupported && bioClean !== (bio ?? "")) ||
    backdropChanged;
  const canSave = changed && nameValid && handleValid && !saving;
  const hero = top.find((poster) => poster.id === backdropId) ?? top[0] ?? null;
  const heroSrc = hero ? backdropUrl(hero.backdropPath, "w780") : null;

  function save() {
    if (!canSave) return;
    const topIds = backdropChanged
      ? [backdropId!, ...top.map((poster) => poster.id).filter((id) => id !== backdropId)]
      : undefined;
    startSaving(async () => {
      const result = await saveProfileEdits({
        displayName: nameClean,
        username: handle,
        isPublic: publicOn,
        ...(bioSupported ? { bio: bioClean } : {}),
        ...(topIds ? { topIds } : {}),
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      captureAnalytics("profile_updated", { public_profile: publicOn });
      toast.success("Profile saved");
      onOpenChange(false);
      router.refresh();
    });
  }

  const field =
    "w-full rounded-xl border border-border bg-card px-3.5 text-base outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-primary/10 sm:text-[15px]";

  return (
    <Dialog open={open} onOpenChange={(next) => (saving ? null : onOpenChange(next))}>
      <DialogContent
        size="md"
        className="flex max-h-[min(46rem,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 max-sm:max-h-[calc(100dvh-1rem)] [&>button:last-child]:hidden"
      >
        <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="-ml-1 h-11 rounded-xl px-2 text-[15px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-10"
          >
            Cancel
          </button>
          <DialogTitle className="flex-1 text-center text-[17px] font-semibold tracking-[-0.02em]">
            Edit profile
          </DialogTitle>
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="inline-flex h-11 min-w-[4.5rem] items-center justify-center gap-1.5 rounded-[14px] bg-primary px-4 text-sm font-semibold text-primary-foreground transition-[opacity,transform] duration-150 active:scale-[0.98] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-10"
          >
            {saving ? <LoaderCircle aria-hidden className="loading-spinner h-3.5 w-3.5" /> : null}
            {saving ? "Saving" : "Save"}
          </button>
        </div>
        <DialogDescription className="sr-only">
          Change your name, handle, bio, photo, backdrop, Top 4 and who can see your profile.
        </DialogDescription>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {/* The header as it will look: the chosen backdrop with your photo on it. */}
          <div className="relative">
            <div className="relative h-28 overflow-hidden bg-card sm:h-32">
              {heroSrc ? (
                <Image
                  key={heroSrc}
                  src={heroSrc}
                  alt=""
                  fill
                  sizes="512px"
                  className="object-cover object-[50%_25%]"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/20 to-background" />
            </div>
            <div className="relative -mt-12 flex px-4">
              <ProfileAvatarEditor round avatarUrl={avatarUrl} displayName={nameClean || displayName} />
            </div>
          </div>

          <div className="flex flex-col gap-5 px-4 pt-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-muted-foreground">Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={60}
                autoComplete="name"
                aria-invalid={!nameValid}
                className={cn(field, "h-11")}
              />
              {!nameValid ? (
                <span className="text-xs text-destructive">Use 2 to 60 characters.</span>
              ) : null}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-muted-foreground">Handle</span>
              <span className={cn(field, "flex h-11 items-center gap-0.5 focus-within:border-primary/60 focus-within:ring-4 focus-within:ring-primary/10")}>
                <span aria-hidden className="font-mono text-sm text-muted-foreground">@</span>
                <input
                  value={handle}
                  onChange={(event) =>
                    setHandle(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                  }
                  maxLength={30}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-invalid={!handleValid}
                  className="min-w-0 flex-1 bg-transparent font-mono text-base outline-none sm:text-sm"
                />
              </span>
              <span className={cn("truncate text-xs", handleValid ? "text-muted-foreground" : "text-destructive")}>
                {handleValid
                  ? `s1ate.space/u/${handle}`
                  : "Use 3 to 30 lowercase letters, numbers or hyphens."}
              </span>
            </label>

            {bioSupported ? (
              <label className="flex flex-col gap-1.5">
                <span className="flex items-baseline justify-between text-[13px] font-medium text-muted-foreground">
                  Bio
                  <span className={cn("text-xs tabular-nums", about.length > BIO_MAX - 20 ? "text-foreground" : "")}>
                    {about.length}/{BIO_MAX}
                  </span>
                </span>
                <textarea
                  value={about}
                  onChange={(event) => setAbout(event.target.value.slice(0, BIO_MAX))}
                  rows={3}
                  placeholder="A line about what you watch"
                  className={cn(field, "resize-none py-2.5 leading-snug")}
                />
              </label>
            ) : null}

            {backdrops.length > 1 ? (
              <fieldset className="flex min-w-0 flex-col gap-2">
                <legend className="mb-1 text-[13px] font-medium text-muted-foreground">Backdrop</legend>
                <div className="-mx-4 flex snap-x scroll-px-4 gap-2.5 overflow-x-auto px-4 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {backdrops.map((poster) => {
                    const src = backdropUrl(poster.backdropPath, "w300");
                    const chosen = poster.id === backdropId;
                    return (
                      <button
                        key={poster.id}
                        type="button"
                        onClick={() => setBackdropId(poster.id)}
                        aria-pressed={chosen}
                        aria-label={`Use ${poster.title} as your backdrop`}
                        className={cn(
                          "relative aspect-video w-36 shrink-0 snap-start overflow-hidden rounded-[10px] bg-card transition-[box-shadow,opacity] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          chosen
                            ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                            : "opacity-70 hover:opacity-100",
                        )}
                      >
                        {src ? <Image src={src} alt="" fill sizes="144px" className="object-cover" /> : null}
                      </button>
                    );
                  })}
                </div>
                <span className="text-xs text-muted-foreground">
                  From your Top 4. The one you choose moves to first.
                </span>
              </fieldset>
            ) : null}

            <button
              type="button"
              onClick={onEditTop}
              disabled={saving}
              className="group flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 text-left transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span aria-hidden className="flex gap-1">
                {Array.from({ length: 4 }, (_, index) => {
                  const poster = top[index];
                  const src = poster ? posterUrl(poster.posterPath, "w92") : null;
                  return (
                    <span
                      key={index}
                      className={cn(
                        "relative block h-12 w-8 overflow-hidden rounded-md bg-foreground/10",
                        !poster && "border border-dashed border-foreground/20 bg-transparent",
                      )}
                    >
                      {src ? <Image src={src} alt="" fill sizes="32px" className="object-cover" /> : null}
                    </span>
                  );
                })}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-medium">Top 4</span>
                <span className="truncate text-[13px] text-muted-foreground">
                  {top.length ? top.map((poster) => poster.title).join(", ") : "Pick four titles"}
                </span>
              </span>
              <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>

            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border/70 bg-card p-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-foreground/[0.06] text-muted-foreground">
                {publicOn ? <Globe2 aria-hidden className="h-4 w-4" /> : <Lock aria-hidden className="h-4 w-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium leading-tight">Public profile</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
                  {publicOn ? "Anyone with the link can see it." : "Only you can see it."}
                </span>
              </span>
              <span className="relative inline-flex shrink-0">
                <input
                  type="checkbox"
                  checked={publicOn}
                  onChange={(event) => setPublicOn(event.currentTarget.checked)}
                  className="peer sr-only"
                />
                <span className="h-7 w-12 rounded-full bg-foreground/15 transition-colors duration-200 peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background" />
                <span className="absolute left-[3px] top-[3px] h-[22px] w-[22px] rounded-full bg-white transition-transform duration-[320ms] ease-[var(--ease-ui-move)] peer-checked:translate-x-5 peer-active:scale-95 motion-reduce:transition-none" />
                <span className="absolute left-[3px] top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow-sm transition-transform duration-200 ease-[var(--ease-ui-out)] peer-checked:translate-x-5 peer-active:scale-95 motion-reduce:transition-none" />
              </span>
            </label>

            <Link
              href="/profile/settings"
              className="self-start rounded-md text-[13px] font-medium text-primary hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              More settings: appearance, account
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
