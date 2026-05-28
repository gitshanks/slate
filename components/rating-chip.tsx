/**
 * Inline rating — branded badge + score, optionally linked to the source.
 * Sits in the title/discover meta line (Film · Year · Runtime · …) so it
 * matches that row's plain mono style rather than being a separate pill.
 */

import * as React from "react";

interface RatingChipProps {
  /** Branded SVG indicator (ImdbBadge / RottenTomatoesBadge / MetacriticBadge). */
  icon: React.ReactNode;
  /** Score text — "8.8", "87%", "76". */
  label: string;
  /** External URL for the score's source. Renders as plain text if absent. */
  href?: string | null;
}

export function RatingChip({ icon, label, href }: RatingChipProps) {
  const inner = (
    <>
      {icon}
      <span className="font-mono tabular-nums">{label}</span>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
      >
        {inner}
      </a>
    );
  }
  return <span className="inline-flex items-center gap-1">{inner}</span>;
}
