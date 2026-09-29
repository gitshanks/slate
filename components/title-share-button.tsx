"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Check, Copy, Film, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { captureAnalytics } from "@/lib/analytics";
import { posterUrl, backdropUrl } from "@/lib/tmdb-image";
import { parseSharedTitle, titleSharePath, type ShareableTitle } from "@/lib/title-sharing";
import { cn } from "@/lib/utils";
import styles from "./title-sharing.module.css";

export function TitleShareButton({ title, source = "title_detail", label = "Share", className, onOpenChange }: {
  title: ShareableTitle;
  source?: string;
  label?: string;
  className?: string;
  onOpenChange?: (open: boolean) => void;
}) {
  const [nativeAvailable, setNativeAvailable] = useState(false);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  if (!parseSharedTitle(title.media_type, title.tmdb_id)) return null;
  const path = titleSharePath(title.media_type, title.tmdb_id);
  const poster = posterUrl(title.poster_path, "w342");
  const backdrop = backdropUrl(title.backdrop_path, "w780");
  const properties = { media_type: title.media_type, tmdb_id: title.tmdb_id, source };
  const url = () => new URL(path, window.location.origin).href;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      captureAnalytics("title_share_link_copied", properties);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      toast.error("Couldn't copy the link. Open the shared page to copy its address.");
    }
  }

  async function send() {
    if (sending) return;
    setSending(true);
    try {
      // Keep this call in the click handler: native sharing needs user activation.
      await navigator.share({ title: `${title.title} · slate`, text: `Thought you might like ${title.title}.`, url: url() });
      // A resolved share sheet does not prove that a message was delivered.
      captureAnalytics("title_share_sheet_completed", properties);
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        toast.error("Sharing isn't available here. Copy the link instead.");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog onOpenChange={(open) => {
      setCopied(false);
      onOpenChange?.(open);
      if (open) {
        setNativeAvailable(typeof navigator.share === "function");
        captureAnalytics("title_share_opened", properties);
      }
    }}>
      <DialogTrigger asChild>
        <button type="button" aria-label={`Share ${title.title}`} title="Share title" data-analytics-action="share_title"
          className={cn("inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-border bg-card text-xs font-medium transition-colors hover:border-primary/40 hover:bg-card/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", label ? "px-3" : "w-9", className)}>
          <Share2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />{label}
        </button>
      </DialogTrigger>
      <DialogContent placement="center" className={`${styles.shareDialog} w-[calc(100%-2rem)] max-w-sm gap-0 overflow-hidden rounded-[1.75rem] p-0 sm:max-w-sm`}>
        <div className={styles.shareArtwork} aria-hidden>
          {backdrop ? <Image src={backdrop} alt="" fill sizes="384px" className={styles.shareBackdrop} /> : null}
          <div className={styles.sharePoster}>
            <Film className="h-8 w-8 text-muted-foreground" />
            {poster ? <Image src={poster} alt="" fill sizes="112px" className="object-cover" onError={(event) => { event.currentTarget.hidden = true; }} /> : null}
          </div>
        </div>
        <div className="min-w-0 px-6 pb-6 text-center">
          <DialogTitle className="text-2xl font-semibold leading-tight tracking-[-0.04em]">{title.title}</DialogTitle>
          <p className="mt-2 text-xs text-muted-foreground">{[title.media_type === "movie" ? "Film" : "Series", title.release_date?.slice(0, 4)].filter(Boolean).join(" · ")}</p>
          <DialogDescription className="mt-4 text-[13px] leading-6">Send the trailer and details in one link.</DialogDescription>
          <div className="mt-5 grid gap-2">
            {nativeAvailable ? <button type="button" onClick={send} disabled={sending} className={styles.primaryAction}><Share2 className="h-4 w-4" aria-hidden />{sending ? "Opening…" : "Send to a friend"}</button> : null}
            <button type="button" onClick={copy} className={nativeAvailable ? styles.secondaryAction : styles.primaryAction}>
              {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              <span aria-live="polite">{copied ? "Link copied" : "Copy link"}</span>
            </button>
          </div>
          <Link href={path} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-8 items-center gap-1 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
            Preview shared page <ArrowUpRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
