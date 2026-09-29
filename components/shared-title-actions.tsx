"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Check, LoaderCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { TitleShareButton } from "@/components/title-share-button";
import { ANALYTICS_CONSENT_EVENT, captureAnalytics, readAnalyticsConsent } from "@/lib/analytics";
import { saveSharedTitle } from "@/lib/shared-title-actions";
import type { ShareableTitle } from "@/lib/title-sharing";
import { APP_ROOT } from "@/lib/public-mode";
import styles from "./title-sharing.module.css";

export function SharedTitleActions({ title }: { title: ShareableTitle }) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const viewed = useRef(false);

  useEffect(() => {
    function track() {
      if (viewed.current || readAnalyticsConsent() !== "granted") return;
      viewed.current = true;
      captureAnalytics("shared_title_viewed", { media_type: title.media_type, tmdb_id: title.tmdb_id });
    }
    track();
    window.addEventListener(ANALYTICS_CONSENT_EVENT, track);
    return () => window.removeEventListener(ANALYTICS_CONSENT_EVENT, track);
  }, [title.media_type, title.tmdb_id]);

  function save() {
    const properties = { media_type: title.media_type, tmdb_id: title.tmdb_id };
    captureAnalytics("shared_title_save_started", properties);
    startTransition(async () => {
      try {
        const result = await saveSharedTitle(title.media_type, title.tmdb_id);
        if (!result.ok) {
          if (result.destination) {
            captureAnalytics("shared_title_join_started", properties);
            router.push(result.destination);
          } else toast.error(result.message || "Couldn't save this title. Try again.");
          return;
        }
        setSaved(true);
        captureAnalytics("shared_title_saved", properties);
      } catch {
        toast.error("Couldn't save this title. Try again.");
      }
    });
  }

  return (
    <div className="mt-7" data-analytics-area="shared_title">
      <div className="flex flex-wrap items-center gap-2.5">
        {saved ? (
          <Link href={APP_ROOT} className={styles.primaryAction}><Check className="h-4 w-4" aria-hidden />In your slate <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /></Link>
        ) : (
          <button type="button" onClick={save} disabled={pending} className={styles.primaryAction}>
            {pending ? <LoaderCircle className="loading-spinner h-4 w-4" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
            {pending ? "One moment…" : "Save to my slate"}
          </button>
        )}
        <TitleShareButton title={title} label="Pass it on" source="shared_title" className="h-12 px-5" />
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground" aria-live="polite">
        {saved ? "A good recommendation, kept. Know someone who'd like it too?" : "Your own watchlist for recommendations worth keeping. Free to join."}
      </p>
    </div>
  );
}
