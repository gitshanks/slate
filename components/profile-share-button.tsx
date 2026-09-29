"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Check, Copy, Film, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { captureAnalytics } from "@/lib/analytics";
import { posterUrl } from "@/lib/tmdb-image";
import type { TitleRow } from "@/lib/types";
import styles from "./profile-share-button.module.css";

type ShareTitle = Pick<TitleRow, "id" | "tmdb_id" | "media_type" | "title" | "poster_path" | "favorite">;

function SharePoster({ title }: { title: ShareTitle | null }) {
  const [failed, setFailed] = useState(false);
  const src = posterUrl(title?.poster_path, "w185");

  return (
    <>
      <span className={styles.posterFallback}>
        <Film className="h-5 w-5 opacity-40" />
        {title ? <span>{title.title}</span> : null}
      </span>
      {src && !failed ? (
        <Image src={src} alt="" fill sizes="100px" className="object-cover" onError={() => setFailed(true)} />
      ) : null}
    </>
  );
}

export function ProfileShareButton({
  username,
  displayName,
  avatarUrl,
  titles,
}: {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  titles: ShareTitle[];
}) {
  const [copied, setCopied] = useState(false);
  const [animateArt, setAnimateArt] = useState(false);
  const [animateFeedback, setAnimateFeedback] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profilePath = `/u/${username}`;
  const posters = useMemo(() => {
    // Prefer favorites, then keep the library's order. Never depend on filters.
    const seen = new Set<string>();
    const selected: ShareTitle[] = [];
    for (const title of [...titles.filter((item) => item.favorite), ...titles]) {
      const key = `${title.media_type}:${title.tmdb_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      selected.push(title);
      if (selected.length === 5) break;
    }
    return selected;
  }, [titles]);
  const artwork: (ShareTitle | null)[] = posters.length ? posters : [null, null, null];

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function copyLink(event: MouseEvent<HTMLButtonElement>) {
    setAnimateFeedback(event.detail > 0);
    try {
      await navigator.clipboard.writeText(new URL(profilePath, window.location.origin).href);
      captureAnalytics("profile_link_copied", { public_profile: true, source: "library_toolbar" });
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      toast.error("Couldn't copy the link. Open your profile to copy its address.");
    }
  }

  return (
    <Dialog onOpenChange={() => setCopied(false)}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Share profile"
          title="Share profile"
          data-analytics-action="open_profile_share"
          data-analytics-area="library_toolbar"
          onPointerDown={() => setAnimateArt(true)}
          onKeyDown={() => setAnimateArt(false)}
          className={`${styles.trigger} inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-primary/30 px-3 text-xs font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background max-[379px]:w-10 max-[379px]:px-0 md:max-xl:w-10 md:max-xl:px-0`}
        >
          <Share2 className="h-3.5 w-3.5" aria-hidden />
          <span className="max-[379px]:sr-only md:max-xl:sr-only">Share<span className="hidden xl:inline"> profile</span></span>
        </button>
      </DialogTrigger>
      <DialogContent
        placement="center"
        className={`${styles.panel} w-[calc(100%-2rem)] max-w-[25rem] gap-0 overflow-x-hidden overflow-y-auto rounded-[1.75rem] border-foreground/10 p-0 sm:max-w-[25rem]`}
        data-animate={animateArt}
        data-analytics-private
      >
        <div className={styles.artwork} aria-hidden>
          {artwork.map((title, index) => {
            const position = index - (artwork.length - 1) / 2;
            return (
              <div
                key={title?.id ?? index}
                className={styles.poster}
                style={{
                  "--position": position,
                  "--angle": `${position * 8}deg`,
                  "--drop": `${Math.abs(position) * 10}px`,
                  zIndex: artwork.length - Math.floor(Math.abs(position)),
                } as CSSProperties}
              >
                <SharePoster title={title} />
              </div>
            );
          })}
        </div>

        <div className="min-w-0 px-5 pb-6 sm:px-7 sm:pb-7">
          <DialogTitle className="text-center text-[1.85rem] font-semibold leading-tight tracking-[-0.05em]">
            Share your slate
          </DialogTitle>
          <DialogDescription className="mx-auto mt-2 max-w-[29ch] text-center text-[13px] leading-[1.65]">
            Let friends in on what you&apos;re watching and what you&apos;ve loved.
          </DialogDescription>

          <div className="mt-6 flex min-w-0 items-center gap-3 rounded-2xl border border-border/70 bg-foreground/[0.025] p-3">
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-medium text-primary">
              <span aria-hidden>{displayName.slice(0, 1).toLocaleUpperCase()}</span>
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" onError={(event) => { event.currentTarget.hidden = true; }} />
              ) : null}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium tracking-tight">{displayName}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">@{username}</p>
            </div>
            <span className="flex shrink-0 items-center gap-1.5 pr-1 text-[11px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
              Public
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={copyLink} className={`${styles.copyButton} inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:px-3`}>
              <span className={styles.copyIcon} data-copied={copied} data-animate={animateFeedback} aria-hidden>
                <Copy className="h-4 w-4" />
                <Check className="h-4 w-4" />
              </span>
              <span aria-live="polite">{copied ? "Link copied" : "Copy link"}</span>
            </button>
            <Link href={profilePath} target="_blank" rel="noreferrer" className={`${styles.secondaryButton} inline-flex h-12 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-border px-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:px-3`}>
              View profile <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
