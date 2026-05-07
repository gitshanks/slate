import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Star, ExternalLink } from "lucide-react";
import { supabase, type TitleRow } from "@/lib/supabase";
import { getTitleMeta } from "@/lib/tmdb";
import { posterUrl as rawPosterUrl } from "@/lib/tmdb-image";
import { BackdropHero } from "@/components/backdrop-hero";
import { StatusPill } from "@/components/status-pill";
import { SentimentRating } from "@/components/sentiment-rating";
import { ReviewSheet } from "@/components/review-sheet";
import { RemoveButton } from "@/components/remove-button";
import { TrailerButton } from "@/components/trailer-button";
import { WatchProvidersButton } from "@/components/watch-providers-button";
import { AddTitleToListButton } from "@/components/add-title-to-list-button";
import { TmdbRail } from "@/components/tmdb-rail";
import { CastRail } from "@/components/cast-rail";
import { EpisodePosition } from "@/components/episode-position";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ImdbBadge,
  MetacriticBadge,
  RottenTomatoesBadge,
} from "@/components/rating-icons";
import { RatingChip } from "@/components/rating-chip";
import {
  formatImdbRating,
  formatMetacriticScore,
  formatRtScore,
  formatRuntime,
  formatYear,
  metacriticSearchUrl,
  rottenTomatoesSearchUrl,
} from "@/lib/utils";

// The public demo keeps per-visitor mutations in a cookie-backed sandbox,
// which means the title row for a freshly-added ID only exists in the
// adder's cookie. ISR would cache one visitor's render and serve it to
// everyone else (who don't have that ID in their cookie → 404). Forcing
// dynamic rendering keeps demo mode correct, and bot crawls of /title/*
// are blocked by robots.txt so real CPU cost stays tiny.
export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: PageProps<"/title/[id]">
): Promise<Metadata> {
  const { id } = await props.params;
  const { data } = await supabase
    .from("titles")
    .select("title")
    .eq("id", id)
    .single();
  const name = (data as { title: string } | null)?.title;
  return { title: name ? `slate — ${name}` : "slate — Title" };
}

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

async function TitleTrailerAndProviders({
  type,
  tmdbId,
  titleName,
}: {
  type: "movie" | "tv";
  tmdbId: number;
  titleName: string;
}) {
  const meta = await getTitleMeta(type, tmdbId);
  if (!meta.trailerKey && !meta.watchProviders) return null;
  return (
    <>
      {meta.trailerKey && (
        <TrailerButton trailerKey={meta.trailerKey} titleName={titleName} />
      )}
      {meta.watchProviders && meta.watchProviders.providers.length > 0 && (
        <WatchProvidersButton
          providers={meta.watchProviders.providers}
          link={meta.watchProviders.link}
          titleName={titleName}
        />
      )}
    </>
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
  const imdbScore = formatImdbRating(title.imdb_rating);
  const rtScore = formatRtScore(title.rt_score);
  const mcScore = formatMetacriticScore(title.metacritic_score);
  const imdbUrl = title.imdb_id ? `https://www.imdb.com/title/${title.imdb_id}/` : null;
  // RT primary, Metacritic fallback — same shape (0–100), saves space. We
  // don't store stable slugs for RT/MC so the chip points at their search
  // page; both sites auto-redirect to the title when there's a clear hit.
  const criticChip = rtScore
    ? ({
        kind: "rt" as const,
        score: typeof title.rt_score === "number" ? title.rt_score : null,
        label: rtScore,
        href: rottenTomatoesSearchUrl(title.title),
      })
    : mcScore
      ? ({
          kind: "mc" as const,
          score:
            typeof title.metacritic_score === "number" ? title.metacritic_score : null,
          label: mcScore,
          href: metacriticSearchUrl(title.title),
        })
      : null;

  const { data: listsData } = await supabase
    .from("lists")
    .select("id, name")
    .order("name", { ascending: true });
  const userLists = (listsData ?? []) as { id: string; name: string }[];

  return (
    <div className="relative -mx-4 -my-8 sm:-mx-6 sm:-my-10 lg:-mx-10 lg:-my-14 pb-20">
      {ambientBg && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 opacity-[0.025] dark:opacity-[0.07]"
          style={{
            backgroundImage: `url(${ambientBg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(80px) saturate(2)",
          }}
        />
      )}

      <BackdropHero path={title.backdrop_path} alt={title.title} />

      <div className="relative z-10 pt-8 px-4 sm:pt-10 sm:px-6 lg:pt-14 lg:px-10">
        <div>

          {/* Main content */}
          <div>
            {/* Primary meta — type · year · runtime, kept tight and readable */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-mono uppercase tracking-[0.08em] text-muted-foreground">
              <span className="text-foreground/80">
                {title.media_type === "movie" ? "Film" : "Series"}
              </span>
              {year && (
                <>
                  <span aria-hidden className="opacity-40">·</span>
                  <span>{year}</span>
                </>
              )}
              {runtime && (
                <>
                  <span aria-hidden className="opacity-40">·</span>
                  <span>{runtime}</span>
                </>
              )}
            </div>

            {/* Title */}
            <h1 className="mt-2 max-w-4xl text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
              {title.title}
            </h1>

            {/* Genre chips + rating chips — separate from title meta so they're scannable */}
            {((title.genres && title.genres.length > 0) || imdbScore || criticChip) && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {(title.genres ?? []).map((g) => (
                  <span
                    key={g.id}
                    className="inline-flex h-6 items-center rounded-full bg-muted/60 px-2.5 text-[11px] text-foreground/80"
                  >
                    {g.name}
                  </span>
                ))}
                {imdbScore && (
                  <RatingChip
                    icon={<ImdbBadge className="h-3 w-auto" />}
                    label={imdbScore}
                    href={imdbUrl}
                  />
                )}
                {criticChip?.kind === "rt" && (
                  <RatingChip
                    icon={<RottenTomatoesBadge score={criticChip.score} className="h-3 w-auto" />}
                    label={criticChip.label}
                    href={criticChip.href}
                  />
                )}
                {criticChip?.kind === "mc" && (
                  <RatingChip
                    icon={<MetacriticBadge score={criticChip.score} className="h-3 w-auto" />}
                    label={criticChip.label}
                    href={criticChip.href}
                  />
                )}
              </div>
            )}

            {/* Tagline + director stream in (fallback=null so title stays put) */}
            <Suspense fallback={null}>
              <TitleTaglineDirector
                type={title.media_type}
                tmdbId={title.tmdb_id}
                mediaType={title.media_type}
              />
            </Suspense>

            {/* Single action row: status · sentiment · delete · trailer · providers · add-to-list */}
            {/* Everything is h-9 so they align on the same baseline */}
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <StatusPill titleId={title.id} status={title.status} />
              <SentimentRating
                titleId={title.id}
                rating={title.rating != null ? Number(title.rating) : null}
              />
              <RemoveButton titleId={title.id} titleName={title.title} iconOnly />
              <Suspense fallback={null}>
                <TitleTrailerAndProviders
                  type={title.media_type}
                  tmdbId={title.tmdb_id}
                  titleName={title.title}
                />
              </Suspense>
              <AddTitleToListButton titleId={title.id} lists={userLists} />
              <ReviewSheet
                titleId={title.id}
                titleName={title.title}
                initialReview={title.review}
              />
            </div>

            {/* Episode-position picker — only TV currently being watched. */}
            {title.media_type === "tv" &&
              title.status === "watching" &&
              title.seasons &&
              title.seasons.length > 0 && (
                <div className="mt-6 max-w-2xl">
                  <EpisodePosition
                    titleId={title.id}
                    currentSeason={title.current_season}
                    currentEpisode={title.current_episode}
                    seasons={title.seasons}
                  />
                </div>
              )}

            {/* Overview — from Supabase, immediate */}
            {title.overview && (
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-foreground/85">
                {title.overview}
              </p>
            )}

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
