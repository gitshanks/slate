import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Play } from "lucide-react";
import type { TitleRow } from "@/lib/supabase";
import { TrailerButton } from "@/components/trailer-button";
import { backdropUrl, posterUrl } from "@/lib/tmdb-image";
import { getTitleMeta } from "@/lib/tmdb";
import { formatYear } from "@/lib/utils";

interface HomeHeroProps {
  titles: TitleRow[];
}

/**
 * Cinematic anchor at the top of the home page. Chooses one title from the
 * library using a priority chain (watching → want → loved) and renders it
 * as a full-bleed backdrop with CTAs.
 *
 * Returns null if the library is empty so the page falls back to its
 * existing empty state.
 */
export async function HomeHero({ titles }: HomeHeroProps) {
  if (titles.length === 0) return null;

  // Priority chain — first match wins.
  const watching = titles
    .filter((t) => t.status === "watching")
    .sort(
      (a, b) =>
        new Date(b.watched_at ?? b.added_at).getTime() -
        new Date(a.watched_at ?? a.added_at).getTime()
    );
  const want = titles
    .filter((t) => t.status === "want")
    .sort(
      (a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime()
    );
  const loved = titles.filter(
    (t) => t.status === "watched" && t.rating != null && Number(t.rating) === 3
  );

  let picked: TitleRow | null = null;
  let contextLabel = "";
  if (watching.length > 0) {
    picked = watching[0];
    contextLabel = "Continue watching";
  } else if (want.length > 0) {
    picked = want[0];
    contextLabel = "Up next";
  } else if (loved.length > 0) {
    // Daily-stable pick from loved titles so it feels chosen, not random on
    // every request.
    const day = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    picked = loved[day % loved.length];
    contextLabel = "Revisit";
  }

  if (!picked) return null;

  const title = picked;
  const year = formatYear(title.release_date);
  const poster = posterUrl(title.poster_path, "w342");
  const backdrop = backdropUrl(title.backdrop_path, "w1280");

  // Fetch trailer key (cached 1h by getTitleMeta).
  const meta = await getTitleMeta(title.media_type, title.tmdb_id).catch(
    () => null
  );
  const trailerKey = meta?.trailerKey ?? null;

  return (
    <div className="relative -mx-4 -mt-8 mb-10 h-[45vh] min-h-[380px] overflow-hidden sm:-mx-6 sm:-mt-10 lg:-mx-10 lg:-mt-14">
      {backdrop ? (
        <Image
          src={backdrop}
          alt={title.title}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      ) : (
        <div className="h-full w-full bg-card" />
      )}
      {/* Color wash + fade to bg */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/10" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.18),transparent_55%)]" />

      <div className="absolute inset-x-0 bottom-0 px-4 pb-8 sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-[1480px] items-end gap-6">
          {poster && (
            <div className="relative hidden aspect-[2/3] w-[120px] shrink-0 overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/40 md:block lg:w-[140px]">
              <Image
                src={poster}
                alt={title.title}
                fill
                priority
                sizes="140px"
                className="object-cover"
              />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.2em] text-primary font-mono">
              {contextLabel}
            </p>
            <h1 className="mt-2 line-clamp-2 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
              {title.title}
            </h1>
            <p className="mt-2 text-xs text-muted-foreground font-mono uppercase tracking-wider">
              {title.media_type === "movie" ? "Film" : "Series"}
              {year && <span> · {year}</span>}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href={`/title/${title.id}`}
                prefetch
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                Open
                <ArrowRight className="h-4 w-4" />
              </Link>
              {trailerKey ? (
                <TrailerButton
                  trailerKey={trailerKey}
                  titleName={title.title}
                />
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs text-muted-foreground">
                  <Play className="h-3.5 w-3.5" />
                  No trailer
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
