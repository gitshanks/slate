import { Star } from "lucide-react";
import { formatImdbRating, formatRtScore } from "@/lib/utils";

interface RatingPairProps {
  imdb: number | string | null | undefined;
  rt: number | string | null | undefined;
  /** "compact" — single chip for poster cards. "inline" — text for label rows. */
  variant?: "compact" | "inline";
}

/**
 * IMDB rating + Rotten Tomatoes Tomatometer, side by side. Renders nothing
 * when both values are missing so callers can drop it in unconditionally.
 */
export function RatingPair({ imdb, rt, variant = "inline" }: RatingPairProps) {
  const i = formatImdbRating(imdb);
  const r = formatRtScore(rt);
  if (!i && !r) return null;

  if (variant === "compact") {
    return (
      <span className="font-mono tabular-nums">
        {i && (
          <>
            <Star
              className="mr-0.5 inline h-2.5 w-2.5 -translate-y-px fill-[hsl(var(--star))] text-[hsl(var(--star))]"
              aria-hidden
            />
            {i}
          </>
        )}
        {i && r && <span className="opacity-50"> · </span>}
        {r && <>{r}</>}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {i && (
        <span className="inline-flex items-center gap-1">
          <Star
            className="h-3 w-3 fill-[hsl(var(--star))] text-[hsl(var(--star))]"
            aria-hidden
          />
          <span>{i} IMDB</span>
        </span>
      )}
      {i && r && <span aria-hidden>·</span>}
      {r && <span>{r} RT</span>}
    </span>
  );
}
