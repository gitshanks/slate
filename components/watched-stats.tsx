import { Heart, ThumbsUp, ThumbsDown, Circle } from "lucide-react";
import type { TitleRow } from "@/lib/supabase";
import { formatTmdbScore } from "@/lib/utils";

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
  let tmdbSum = 0;
  let tmdbCount = 0;

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

    if (t.tmdb_rating != null && Number(t.tmdb_rating) > 0) {
      tmdbSum += Number(t.tmdb_rating);
      tmdbCount += 1;
    }
  }

  const tmdbAvg = tmdbCount > 0 ? formatTmdbScore(tmdbSum / tmdbCount) : null;
  const total = titles.length || 1;

  const stats: { label: string; value: string }[] = [
    { label: "This year", value: String(thisYear) },
    { label: "This month", value: String(thisMonth) },
    { label: "Avg TMDB", value: tmdbAvg ?? "—" },
    { label: "Loved", value: String(loved) },
  ];

  const segments: {
    key: string;
    count: number;
    label: string;
    icon: React.ReactNode;
    color: string;
  }[] = [
    {
      key: "loved",
      count: loved,
      label: "Loved",
      icon: <Heart className="h-3 w-3" />,
      color: "bg-rose-500/80",
    },
    {
      key: "liked",
      count: liked,
      label: "Liked",
      icon: <ThumbsUp className="h-3 w-3" />,
      color: "bg-emerald-500/70",
    },
    {
      key: "disliked",
      count: disliked,
      label: "Disliked",
      icon: <ThumbsDown className="h-3 w-3" />,
      color: "bg-amber-500/70",
    },
    {
      key: "unrated",
      count: unrated,
      label: "Unrated",
      icon: <Circle className="h-3 w-3" />,
      color: "bg-muted-foreground/30",
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
        <div className="rounded-2xl border border-border bg-card/60 px-5 py-5 backdrop-blur">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Sentiment
          </p>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted/40">
            {segments.map((seg) =>
              seg.count > 0 ? (
                <div
                  key={seg.key}
                  className={seg.color}
                  style={{ width: `${(seg.count / total) * 100}%` }}
                  aria-label={`${seg.label}: ${seg.count}`}
                />
              ) : null
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-[11px] text-muted-foreground">
            {segments.map((seg) => (
              <div key={seg.key} className="flex items-center gap-1.5">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${seg.color}`}
                  aria-hidden
                />
                {seg.icon}
                <span>
                  {seg.label} · <span className="text-foreground">{seg.count}</span>
                  <span className="text-muted-foreground/60"> ({Math.round((seg.count / total) * 100)}%)</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
