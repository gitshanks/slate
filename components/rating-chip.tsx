/**
 * A rating — branded badge + score, optionally linked to the source.
 *
 * "inline" sits in the title/discover meta line (Film · Year · Runtime · …)
 * matching that row's plain mono style; used on desktop. "pill" is the
 * standalone bordered chip used in the mobile chip row below the title.
 */

import * as React from "react";

interface RatingChipProps {
  /** Branded SVG indicator (ImdbBadge / RottenTomatoesBadge / MetacriticBadge). */
  icon: React.ReactNode;
  /** Score text — "8.8", "87%", "76". */
  label: string;
  /** External URL for the score's source. Renders as plain text if absent. */
  href?: string | null;
  variant?: "inline" | "pill";
}

export function RatingChip({ icon, label, href, variant = "inline" }: RatingChipProps) {
  const inner = (
    <>
      {icon}
      <span className="font-mono tabular-nums">{label}</span>
    </>
  );

  const base =
    variant === "pill"
      ? "inline-flex h-6 items-center gap-1.5 rounded-full border border-border bg-card px-2 text-[11px]"
      : "inline-flex items-center gap-1";

  if (href) {
    const hover =
      variant === "pill" ? "hover:bg-card/70" : "hover:text-foreground";
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`${base} transition-colors ${hover}`}
      >
        {inner}
      </a>
    );
  }
  return <span className={base}>{inner}</span>;
}
