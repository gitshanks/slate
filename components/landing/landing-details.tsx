"use client";

import Link from "next/link";
import { Bookmark } from "lucide-react";
import { SLATE_HOSTED } from "@/lib/public-mode";
import styles from "./index-landing.module.css";

/**
 * Under the hero: the sections passed in (this week's list, how Slate works,
 * the lists made by Slate), then the closing call to action.
 */
export function LandingDetails({
  createHref,
  sections,
}: {
  createHref: string;
  sections?: React.ReactNode;
}) {
  return (
    <div className={styles.details}>
      {sections}

      <section className={styles.closing} aria-labelledby="closing-title">
        <Bookmark className={styles.closingIcon} aria-hidden="true" />
        <h2 id="closing-title">
          Make room for your next great watch.
        </h2>
        <p>Start with the one you’ve been meaning to see.</p>
        <Link className={styles.primaryAction} href={createHref} scroll={false}>
          {SLATE_HOSTED ? "Create your slate" : "Open slate"}
        </Link>
        <span className={styles.closingNote}>
          {SLATE_HOSTED
            ? "Free. Private by default. Yours to fill."
            : "Open source. Yours to make your own."}
        </span>
      </section>
    </div>
  );
}
