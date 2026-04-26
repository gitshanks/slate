/**
 * Small inline brand icons that mark which platform a rating comes from.
 * Used wherever we render a score next to its source — poster cards, the
 * title detail page, the discover preview, and the command palette.
 *
 * These are stylized indicator marks, not the official trademark logos —
 * they exist purely to disambiguate scores in cramped UI contexts. Sizing
 * follows lucide-react's pattern: pass `className="h-3 w-..."` from the
 * caller and the SVG scales with `currentColor` where appropriate.
 */

import * as React from "react";
import { metacriticBand } from "@/lib/utils";

type IconProps = React.SVGProps<SVGSVGElement>;

/** IMDb yellow wordmark. */
export function ImdbBadge({ className, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 36 18"
      role="img"
      aria-label="IMDb"
      className={className}
      {...rest}
    >
      <rect width="36" height="18" rx="3" fill="#F5C518" />
      <text
        x="18"
        y="13.5"
        textAnchor="middle"
        fontFamily="Helvetica Neue, Arial, sans-serif"
        fontWeight="900"
        fontSize="11"
        fill="#000"
        letterSpacing="-0.5"
      >
        IMDb
      </text>
    </svg>
  );
}

/**
 * Stylized Rotten Tomatoes mark — red tomato for fresh (≥60), green splat for
 * rotten. When score is null we render the red tomato (most saved titles are
 * fresh on the rare occasions RT has covered them).
 */
export function RottenTomatoesBadge({
  score,
  className,
  ...rest
}: IconProps & { score?: number | null }) {
  const rotten = score != null && score < 60;
  return (
    <svg
      viewBox="0 0 18 18"
      role="img"
      aria-label="Rotten Tomatoes"
      className={className}
      {...rest}
    >
      {rotten ? (
        // Rotten — green splatter blob
        <path
          d="M9 1.2 L11 3.4 L13.5 2.6 L13 5.5 L16 5 L14.4 7.5 L17 9 L14.4 10.5 L16 13 L13 12.5 L13.5 15.4 L11 14.6 L9 16.8 L7 14.6 L4.5 15.4 L5 12.5 L2 13 L3.6 10.5 L1 9 L3.6 7.5 L2 5 L5 5.5 L4.5 2.6 L7 3.4 Z"
          fill="#5BA433"
        />
      ) : (
        <>
          {/* leaf */}
          <path d="M9 1 C 10 3, 11 3.4, 12 3 L 9 5 Z" fill="#2E8B3D" />
          {/* tomato */}
          <circle cx="9" cy="10" r="6.5" fill="#FA320A" />
          {/* highlight */}
          <ellipse cx="6.5" cy="7.8" rx="1.4" ry="0.9" fill="#FF8060" opacity="0.7" />
        </>
      )}
    </svg>
  );
}

/**
 * Metacritic — colored square + "M". The fill follows their canonical
 * 75+/50–74/0–49 traffic-light bands.
 */
export function MetacriticBadge({
  score,
  className,
  ...rest
}: IconProps & { score?: number | null }) {
  const band = metacriticBand(score ?? null);
  const fill =
    band === "good" ? "#66CC33" : band === "mixed" ? "#FFCC33" : band === "bad" ? "#FF0000" : "#888";
  const ink = band === "mixed" ? "#000" : "#000"; // black on all — Metacritic style
  return (
    <svg
      viewBox="0 0 18 18"
      role="img"
      aria-label="Metacritic"
      className={className}
      {...rest}
    >
      <rect width="18" height="18" rx="3" fill={fill} />
      <text
        x="9"
        y="13.5"
        textAnchor="middle"
        fontFamily="Helvetica Neue, Arial, sans-serif"
        fontWeight="900"
        fontSize="13"
        fill={ink}
      >
        M
      </text>
    </svg>
  );
}

/** TMDB teal-to-green gradient wordmark. */
export function TmdbBadge({ className, ...rest }: IconProps) {
  // SSR-safe stable id — different gradient per usage avoids dup-id collisions.
  const gid = React.useId();
  return (
    <svg
      viewBox="0 0 44 18"
      role="img"
      aria-label="TMDB"
      className={className}
      {...rest}
    >
      <defs>
        <linearGradient id={gid} x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#90CEA1" />
          <stop offset="55%" stopColor="#3CBEC9" />
          <stop offset="100%" stopColor="#00B3E5" />
        </linearGradient>
      </defs>
      <rect width="44" height="18" rx="3" fill={`url(#${gid})`} />
      <text
        x="22"
        y="13.5"
        textAnchor="middle"
        fontFamily="Helvetica Neue, Arial, sans-serif"
        fontWeight="900"
        fontSize="11"
        fill="#fff"
        letterSpacing="-0.3"
      >
        TMDB
      </text>
    </svg>
  );
}
