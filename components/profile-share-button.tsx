"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Copy, Globe2, Lock, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { captureAnalytics } from "@/lib/analytics";

export function ProfileShareButton({ username, isPublic }: { username: string; isPublic: boolean }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profilePath = `/u/${username}`;

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function copyLink() {
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
        <button type="button" aria-label="Share profile" data-analytics-action="open_profile_share" data-analytics-area="library_toolbar"
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 text-xs font-medium text-primary outline-none transition-[background-color,border-color,transform] hover:border-primary/45 hover:bg-primary/20 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background max-[379px]:w-10 max-[379px]:px-0 md:max-xl:w-10 md:max-xl:px-0 motion-reduce:transition-none">
          <Share2 className="h-3.5 w-3.5" aria-hidden />
          <span className="max-[379px]:sr-only md:max-xl:sr-only">Share<span className="hidden xl:inline"> profile</span></span>
        </button>
      </DialogTrigger>
      <DialogContent placement="center" className="w-[calc(100%-2rem)] max-w-sm sm:max-w-sm" data-analytics-private>
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary" aria-hidden>
          {isPublic ? <Share2 className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
        </span>
        <DialogTitle className="text-2xl font-semibold tracking-[-0.035em]">Share your slate</DialogTitle>
        <DialogDescription className="leading-6">
          {isPublic ? "Let friends browse what you're watching, what you've loved, and what's up next." : "Your profile is private. Turn on sharing in Profile settings to let friends browse your shelves."}
        </DialogDescription>
        {isPublic ? (
          <>
            <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-border bg-muted/35 px-3.5 py-3 text-xs text-muted-foreground">
              <Globe2 className="h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0 truncate font-mono" title={profilePath}>slate / {username}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={copyLink} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                <span aria-live="polite">{copied ? "Link copied" : "Copy link"}</span>
              </button>
              <Link href={profilePath} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-border px-4 text-xs font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                View profile <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </>
        ) : (
          <Link href="/profile#profile-sharing" className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
            Set up sharing <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
        )}
      </DialogContent>
    </Dialog>
  );
}
