import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Star, ExternalLink } from "lucide-react";
import { supabase, type TitleRow } from "@/lib/supabase";
import { getTitleMeta } from "@/lib/tmdb";
import type { TmdbDetailWithMeta } from "@/lib/tmdb";
import { posterUrl as rawPosterUrl } from "@/lib/tmdb-image";
import { BackdropHero } from "@/components/backdrop-hero";
import { StatusPill } from "@/components/status-pill";
import { SentimentRating } from "@/components/sentiment-rating";
import { ReviewSheet } from "@/components/review-sheet";
import { RemoveButton } from "@/components/remove-button";
import { TrailerButton } from "@/components/trailer-button";
import { WatchProvidersButton } from "@/components/watch-providers-button";
import { TmdbRail } from "@/components/tmdb-rail";
import { CastRail } from "@/components/cast-rail";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRuntime, formatTmdbScore, formatYear } from "@/lib/utils";

export const dynamic = "force-dynamic";

// ─── Async sub-components (all share one cached getTitleMeta call) ──

async function TitleTaglineDirector({
  type,
  tmdbId,
  mediaType,
}: {
  type: "movie" | "tv";
  tmdbId: number;
  mediaType: string;
}) {
  const meta = await getTitleMeta(type, tmdbId);
  return (
    <>
      {meta.tagline && (
        <p className="mt-2 text-sm italic text-muted-foreground">{meta.tagline}</p>
      )}
      {meta.directedBy.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground font-mono">
          {mediaType === "movie" ? "Directed by" : "Created by"}{" "}
          <span className="text-foreground">{meta.directedBy.join(", ")}</span>
        </p>
      )}
    </>
  );
}

async function TitleScoreMobile({
  type,
  tmdbId,
  tmdbUrl,
}: {
  type: "movie" | "tv";
  tmdbId: number;
  tmdbUrl: string;
}) {
  const meta = await getTitleMeta(type, tmdbId);
  const userScore = formatTmdbScore(meta.vote_average);
  if (!userScore) return null;
  return (
    <a
      href={tmdbUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 transition-colors hover:border-primary/40"
    >
      <Star className="h-3.5 w-3.5 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
      <span className="font-mono text-xs font-medium">{userScore}</span>
      <span className="text-[10px] text-muted-foreground">
        TMDB · {meta.vote_count?.toLocaleString() ?? 0}
      </span>
    </a>
  );
}

async function TitleTrailerAndProviders({
  type,
  tmdbId,
  titleName,
  titleId,
}: {
  type: "movie" | "tv";
  tmdbId: number;
  titleName: string;
  titleId: string;
}) {
  const meta = await getTitleMeta(type, tmdbId);
  if (!meta.trailerKey && !meta.watchProviders) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      {meta.trailerKey && (
        <TrailerButton trailerKey={meta.trailerKey} titleName={titleName} />
      )}
      {meta.watchProviders && meta.watchProviders.providers.length > 0 && (
        <WatchProvidersButton
          providers={meta.watchProviders.providers}
          link={meta.watchProviders.link}
        />
      )}
    </div>
  );
}

async function TitleCastRecsReviews({
  type,
  tmdbId,
  titleName,
  tmdbUrl,
}: {
  type: "movie" | "tv";
  tmdbId: number;
  titleName: string;
  tmdbUrl: string;
}) {
  const meta = await getTitleMeta(type, tmdbId);
  return (
    <>
      {meta.cast.length > 0 && <CastRail cast={meta.cast} />}

      {meta.reviews.length > 0 && (
        <div className="mt-12">
          <a
            href={tmdbUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono hover:text-foreground transition-colors"
          >
            What people are saying
            <ExternalLink className="h-3 w-3" />
          </a>
          <div className="mt-5 space-y-4">
            {meta.reviews.map((r) => {
              const rating = r.author_details?.rating ?? null;
              const date = new Date(r.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              });
              return (
                <article
                  key={r.id}
                  className="rounded-2xl border border-border bg-card p-5"
                >
                  <header className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-medium">{r.author}</span>
                      {rating != null && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-mono">
                          <Star className="h-3 w-3 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
                          {rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground font-mono">
                      {date}
                    </span>
                  </header>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/80">
                    {r.content}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {meta.recommendations.length > 0 && (
        <TmdbRail
          title={`If you liked ${titleName}…`}
          items={meta.recommendations}
        />
      )}
    </>
  );
}

// ─── Page ──────────────────────────────────────────────────────────

export default async function TitleDetailPage(props: PageProps<"/title/[id]">) {
  const { id } = await props.params;

  const { data, error } = await supabase
    .from("titles")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) notFound();

  const title = data as TitleRow;
  const year = formatYear(title.release_date);
  const runtime = formatRuntime(title.runtime);
  const ambientBg = rawPosterUrl(title.poster_path, "w342");
  const tmdbUrl = `https://www.themoviedb.org/${title.media_type}/${title.tmdb_id}`;

  return (
    <div className="-mx-4 -my-8 sm:-mx-6 sm:-my-10 lg:-mx-10 lg:-my-14 pb-20 overflow-x-hidden">
      {ambientBg && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 opacity-[0.07]"
          style={{
            backgroundImage: `url(${ambientBg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(80px) saturate(3)",
          }}
        />
      )}

      <BackdropHero path={title.backdrop_path} alt={title.title} />

      <div className="relative -mt-44 px-4 sm:-mt-48 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-3xl">

          {/* Main content */}
          <div>
            {/* Label row */}
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
              {title.media_type === "movie" ? "Film" : "Series"}
              {year && <span> · {year}</span>}
              {runtime && <span> · {runtime}</span>}
            </p>

            {/* Title */}
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
              {title.title}
            </h1>

            {/* Tagline + director stream in (fallback=null so title stays put) */}
            <Suspense fallback={null}>
              <TitleTaglineDirector
                type={title.media_type}
                tmdbId={title.tmdb_id}
                mediaType={title.media_type}
              />
            </Suspense>

            {/* Mobile TMDB score chip streams in */}
            <Suspense fallback={null}>
              <TitleScoreMobile
                type={title.media_type}
                tmdbId={title.tmdb_id}
                tmdbUrl={tmdbUrl}
              />
            </Suspense>

            {/* Genre chips — from Supabase, always immediate */}
            {title.genres && title.genres.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {title.genres.map((g) => (
                  <span
                    key={g.id}
                    className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground"
                  >
                    {g.name}
                  </span>
                ))}
              </div>
            )}

            {/* Action rows — sentiment + remove always immediate */}
            <div className="mt-6 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <SentimentRating
                  titleId={title.id}
                  rating={title.rating != null ? Number(title.rating) : null}
                />
                <RemoveButton titleId={title.id} titleName={title.title} />
              </div>
              <div>
                <StatusPill titleId={title.id} status={title.status} />
              </div>
              {/* Trailer + where to watch stream in */}
              <Suspense fallback={null}>
                <TitleTrailerAndProviders
                  type={title.media_type}
                  tmdbId={title.tmdb_id}
                  titleName={title.title}
                  titleId={title.id}
                />
              </Suspense>
            </div>

            {/* Overview — from Supabase, immediate */}
            {title.overview && (
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-foreground/85">
                {title.overview}
              </p>
            )}

            {/* Notes */}
            <div className="mt-4">
              <ReviewSheet
                titleId={title.id}
                titleName={title.title}
                initialReview={title.review}
              />
            </div>

            {/* Your saved note */}
            {title.review && (
              <div className="mt-8 rounded-2xl border border-border bg-card p-6">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-mono">
                  Your note
                </p>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">
                  {title.review}
                </p>
              </div>
            )}

            {/* Cast, reviews, recommendations — stream in */}
            <Suspense
              fallback={
                <div className="mt-12">
                  <Skeleton shape="text" className="mb-4 h-3 w-12" />
                  <div className="grid grid-cols-4 gap-x-4 gap-y-6 sm:grid-cols-6 md:grid-cols-8">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i}>
                        <Skeleton className="aspect-square w-full rounded-full" />
                        <Skeleton shape="text" className="mt-2 h-2.5 w-4/5 mx-auto" />
                      </div>
                    ))}
                  </div>
                </div>
              }
            >
              <TitleCastRecsReviews
                type={title.media_type}
                tmdbId={title.tmdb_id}
                titleName={title.title}
                tmdbUrl={tmdbUrl}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
