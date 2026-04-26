import {
  formatImdbRating,
  formatMetacriticScore,
  formatRtScore,
} from "@/lib/utils";
import {
  ImdbBadge,
  MetacriticBadge,
  RottenTomatoesBadge,
} from "@/components/rating-icons";

interface RatingPairProps {
  imdb: number | string | null | undefined;
  rt: number | string | null | undefined;
  /** Metacritic Metascore (0–100). Used as RT fallback for titles RT didn't cover. */
  metacritic?: number | string | null | undefined;
  /** "compact" — single chip for poster cards. "inline" — text for label rows. */
  variant?: "compact" | "inline";
}

/**
 * IMDb rating + critic-aggregator score (RT preferred, Metacritic fallback).
 * Renders nothing when nothing is available so callers can drop it in
 * unconditionally.
 *
 * RT coverage in OMDB is sparse for TV / older / foreign titles, so falling
 * through to Metacritic catches most of the gap with a same-shape 0–100 score.
 *
 * - `compact` (poster cards): tiny brand glyph + score, slightly dimmed so
 *   the badges sit quietly next to the numbers instead of competing with
 *   them. Just enough to disambiguate the source at a glance.
 * - `inline` (title detail): full-size badges next to each score, since the
 *   surface has room and the chips are interactive (link out).
 */
export function RatingPair({
  imdb,
  rt,
  metacritic,
  variant = "inline",
}: RatingPairProps) {
  const i = formatImdbRating(imdb);
  const r = formatRtScore(rt);
  const mc = formatMetacriticScore(metacritic);

  // Pick one critic score: RT primary, Metacritic fallback
  const critic = r
    ? ({ kind: "rt" as const, label: r, raw: rt })
    : mc
      ? ({ kind: "mc" as const, label: mc, raw: metacritic })
      : null;

  if (!i && !critic) return null;

  if (variant === "compact") {
    // Slight opacity on each badge SVG (not the wrapping span) so the
    // colored marks read quietly while the score stays at full strength.
    return (
      <span className="inline-flex items-center gap-1 font-mono tabular-nums">
        {i && (
          <span className="inline-flex items-center gap-1">
            <ImdbBadge className="h-2 w-auto opacity-75" />
            <span>{i}</span>
          </span>
        )}
        {i && critic && <span aria-hidden className="opacity-40">·</span>}
        {critic?.kind === "rt" && (
          <span className="inline-flex items-center gap-1">
            <RottenTomatoesBadge
              score={typeof critic.raw === "number" ? critic.raw : null}
              className="h-2 w-auto opacity-75"
            />
            <span>{critic.label}</span>
          </span>
        )}
        {critic?.kind === "mc" && (
          <span className="inline-flex items-center gap-1">
            <MetacriticBadge
              score={typeof critic.raw === "number" ? critic.raw : null}
              className="h-2 w-auto opacity-75"
            />
            <span>{critic.label}</span>
          </span>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      {i && (
        <span className="inline-flex items-center gap-1.5">
          <ImdbBadge className="h-3.5 w-auto" />
          <span className="font-mono tabular-nums text-foreground/90">{i}</span>
        </span>
      )}
      {critic?.kind === "rt" && (
        <span className="inline-flex items-center gap-1.5">
          <RottenTomatoesBadge
            score={typeof critic.raw === "number" ? critic.raw : null}
            className="h-3.5 w-auto"
          />
          <span className="font-mono tabular-nums text-foreground/90">{critic.label}</span>
        </span>
      )}
      {critic?.kind === "mc" && (
        <span className="inline-flex items-center gap-1.5">
          <MetacriticBadge
            score={typeof critic.raw === "number" ? critic.raw : null}
            className="h-3.5 w-auto"
          />
          <span className="font-mono tabular-nums text-foreground/90">{critic.label}</span>
        </span>
      )}
    </span>
  );
}
