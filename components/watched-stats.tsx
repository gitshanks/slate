import { Heart, ThumbsUp, ThumbsDown } from "lucide-react";
import type { TitleRow } from "@/lib/supabase";
import { formatImdbRating } from "@/lib/utils";

interface WatchedStatsProps {
  titles: TitleRow[];
}

/**
 * Dashboard header for /watched — four stat cards + a sentiment breakdown bar.
 * Pure reductions over the already-fetched title list, no extra queries.
 */
export function WatchedStats({ titles }: WatchedStatsProps) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  // Use watched_at when present, otherwise fall back to added_at.
  const dateOf = (t: TitleRow) => {
    const raw = t.watched_at ?? t.added_at;
    return raw ? new Date(raw) : null;
  };

  let thisYear = 0;
  let thisMonth = 0;
  let loved = 0;
  let liked = 0;
  let disliked = 0;
  let unrated = 0;
  let imdbSum = 0;
  let imdbCount = 0;

  for (const t of titles) {
    const d = dateOf(t);
    if (d) {
      if (d.getUTCFullYear() === year) thisYear += 1;
      if (d.getUTCFullYear() === year && d.getUTCMonth() === month) thisMonth += 1;
    }

    const r = t.rating != null ? Number(t.rating) : null;
    if (r === 3) loved += 1;
    else if (r === 2) liked += 1;
    else if (r === 1) disliked += 1;
    else unrated += 1;

    if (t.imdb_rating != null && Number(t.imdb_rating) > 0) {
      imdbSum += Number(t.imdb_rating);
      imdbCount += 1;
    }
  }

  const imdbAvg = imdbCount > 0 ? formatImdbRating(imdbSum / imdbCount) : null;
  const total = titles.length || 1;

  const stats: { label: string; value: string }[] = [
    { label: "This year", value: String(thisYear) },
    { label: "This month", value: String(thisMonth) },
    { label: "Avg IMDB", value: imdbAvg ?? "—" },
    { label: "Watched", value: String(titles.length) },
  ];

  const pills: {
    key: string;
    count: number;
    label: string;
    icon: React.ReactNode;
    borderColor: string;
    bgTint: string;
    textColor: string;
  }[] = [
    {
      key: "loved",
      count: loved,
      label: "Loved",
      icon: <Heart className="h-3 w-3 fill-current" aria-hidden />,
      borderColor: "border-l-rose-500",
      bgTint: "bg-rose-500/5",
      textColor: "text-rose-500",
    },
    {
      key: "liked",
      count: liked,
      label: "Liked",
      icon: <ThumbsUp className="h-3 w-3" aria-hidden />,
      borderColor: "border-l-emerald-500",
      bgTint: "bg-emerald-500/5",
      textColor: "text-emerald-500",
    },
    {
      key: "disliked",
      count: disliked,
      label: "Disliked",
      icon: <ThumbsDown className="h-3 w-3" aria-hidden />,
      borderColor: "border-l-amber-500",
      bgTint: "bg-amber-500/5",
      textColor: "text-amber-500",
    },
  ];

  return (
    <section className="mb-10 space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-border bg-card/60 px-4 py-4 backdrop-blur"
          >
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono">
              {s.label}
            </p>
            <p className="mt-2 font-mono text-2xl font-semibold tabular-nums sm:text-3xl">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {titles.length > 0 && (
        <div>
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Your taste
          </p>
          <div className="grid grid-cols-3 gap-2">
            {pills.map((pill) => (
              <div
                key={pill.key}
                className={`rounded-2xl border border-border border-l-4 ${pill.borderColor} ${pill.bgTint} px-3 py-3 backdrop-blur sm:px-4 sm:py-4`}
              >
                <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] font-mono ${pill.textColor}`}>
                  {pill.icon}
                  <span className="text-muted-foreground">{pill.label}</span>
                </div>
                <p className="mt-2 font-mono text-2xl font-semibold tabular-nums sm:text-3xl">
                  {pill.count}
                </p>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {Math.round((pill.count / total) * 100)}%
                </p>
              </div>
            ))}
          </div>
          {unrated > 0 && (
            <p className="mt-2 font-mono text-[11px] text-muted-foreground/60">
              · {unrated} unrated
            </p>
          )}
        </div>
      )}
    </section>
  );
}
