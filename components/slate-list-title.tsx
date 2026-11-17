import type { ReactNode } from "react";

/**
 * A list made by Slate can dress its own name. Each entry returns the heading's
 * contents; anything not listed renders as plain text.
 */
const DRESSED: Record<string, (name: string) => ReactNode> = {
  // The last 7 becomes a pistol: its top bar runs on as the barrel and its
  // stem is the grip. Drawn here, in the heading's own ink.
  "7-for-007": (name) => (
    <>
      <span aria-hidden>{name}</span>
      <svg
        aria-hidden
        viewBox="0 0 72 71"
        className="-ml-[0.1em] inline-block h-[0.71em] w-[0.72em] overflow-visible align-baseline"
        fill="currentColor"
      >
        {/* barrel, level with the 7's bar */}
        <rect x="0" y="4" width="62" height="14" />
        {/* muzzle and front sight */}
        <rect x="62" y="2" width="10" height="18" rx="1.5" />
        <rect x="51" y="-2" width="5.5" height="7" rx="1" />
        {/* trigger guard and trigger, tucked under the barrel by the stem */}
        <path
          d="M9 18 V28 A16 16 0 0 0 41 28 V18"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path d="M22 18 Q20 29 28 34" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <span className="sr-only">{name}</span>
    </>
  ),
};

export function SlateListTitle({ slug, name }: { slug: string; name: string }) {
  const dressed = DRESSED[slug];
  return <>{dressed ? dressed(name) : name}</>;
}
