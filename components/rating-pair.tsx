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
 * IMDb rating + critic-aggregator score (RT preferred, Metacritic fallback)
 * with branded indicator icons. Renders nothing when nothing is available so
 * callers can drop it in unconditionally.
 *
 * RT coverage in OMDB is sparse for TV / older / foreign titles, so falling
 * through to Metacritic catches most of the gap with a same-shape 0–100 score.
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
    return (
      <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
        {i && (
          <span className="inline-flex items-center gap-0.5">
            <ImdbBadge className="h-2.5 w-auto" />
            <span>{i}</span>
          </span>
        )}
        {i && critic && <span aria-hidden className="opacity-50">·</span>}
        {critic?.kind === "rt" && (
          <span className="inline-flex items-center gap-0.5">
            <RottenTomatoesBadge
              score={typeof critic.raw === "number" ? critic.raw : null}
              className="h-2.5 w-auto"
            />
            <span>{critic.label}</span>
          </span>
        )}
        {critic?.kind === "mc" && (
          <span className="inline-flex items-center gap-0.5">
            <MetacriticBadge
              score={typeof critic.raw === "number" ? critic.raw : null}
              className="h-2.5 w-auto"
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
