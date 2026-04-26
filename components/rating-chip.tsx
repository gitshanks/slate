/**
 * One pill-shaped rating chip — branded badge + score, optionally linked
 * out to the source platform. Used in the meta row on the title detail
 * and discover preview pages, where each rating gets its own clickable
 * pill rather than crowding into a single line.
 */

import * as React from "react";

interface RatingChipProps {
  /** Branded SVG indicator (ImdbBadge / RottenTomatoesBadge / MetacriticBadge). */
  icon: React.ReactNode;
  /** Score text — "8.8", "87%", "76". */
  label: string;
  /** External URL for the score's source. Renders as a non-link if absent. */
  href?: string | null;
}

export function RatingChip({ icon, label, href }: RatingChipProps) {
  const inner = (
    <>
      {icon}
      <span className="font-mono tabular-nums text-foreground/90">{label}</span>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-6 items-center gap-1.5 rounded-full border border-border bg-card px-2 text-[11px] transition-colors hover:bg-card/70"
      >
        {inner}
      </a>
    );
  }
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-border bg-card px-2 text-[11px]">
      {inner}
    </span>
  );
}
