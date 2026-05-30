import { Suspense, Fragment } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
import { CrewRail } from "@/components/crew-rail";
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

// Renders dynamically on-demand anyway (dynamic [id] param + per-visitor
// demo cookie), so the cookie-backed demo render stays correct without ISR.
// Deliberately NOT force-dynamic: that flips every TMDB fetch in
// getTitleMeta to no-store (see lib/tmdb.ts), re-fetching ~6 TMDB endpoints
// on every hit — which is what crawlers turned into millions of TMDB calls.
// TMDB data is universal, so it's served from the Data Cache; only the
// Supabase rows render fresh per request.

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

async function TitleCastAndRecs({
  type,
  tmdbId,
  titleName,
}: {
  type: "movie" | "tv";
  tmdbId: number;
  titleName: string;
}) {
  const meta = await getTitleMeta(type, tmdbId);
  return (
    <>
      {meta.cast.length > 0 && <CastRail cast={meta.cast} />}

      {meta.crew.length > 0 && <CrewRail crew={meta.crew} />}

      {meta.recommendations.length > 0 && (
        <TmdbRail
          title={`If you liked ${titleName}…`}
          items={meta.recommendations}
          layout="grid"
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
            {/* Primary meta — runtime · year · ratings · genres (no media-type
                label). One responsive line: extra genres are sm-only so it
                stays to ~one line on mobile, and flex-wrap prevents overflow. */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-mono uppercase tracking-[0.08em] text-muted-foreground">
              {[
                runtime && (
                  <span key="runtime" className="text-foreground/80">
                    {runtime}
                  </span>
                ),
                year && <span key="year">{year}</span>,
                imdbScore && (
                  <RatingChip
                    key="imdb"
                    icon={<ImdbBadge className="h-3 w-auto" />}
                    label={imdbScore}
                    href={imdbUrl}
                  />
                ),
                criticChip?.kind === "rt" && (
                  <RatingChip
                    key="critic"
                    icon={<RottenTomatoesBadge score={criticChip.score} className="h-3 w-auto" />}
                    label={criticChip.label}
                    href={criticChip.href}
                  />
                ),
                criticChip?.kind === "mc" && (
                  <RatingChip
                    key="critic"
                    icon={<MetacriticBadge score={criticChip.score} className="h-3 w-auto" />}
                    label={criticChip.label}
                    href={criticChip.href}
                  />
                ),
                (title.genres ?? [])[0] && (
                  <span key="genre0">{(title.genres ?? [])[0]?.name}</span>
                ),
              ]
                .filter(Boolean)
                .map((node, i) => (
                  <Fragment key={i}>
                    {i > 0 && <span aria-hidden className="opacity-40">·</span>}
                    {node}
                  </Fragment>
                ))}
              {/* Extra genres — desktop only, so mobile stays compact. */}
              {(title.genres ?? []).slice(1, 3).length > 0 && (
                <span className="hidden sm:contents">
                  {(title.genres ?? []).slice(1, 3).map((g) => (
                    <Fragment key={g.id}>
                      <span aria-hidden className="opacity-40">·</span>
                      <span>{g.name}</span>
                    </Fragment>
                  ))}
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="mt-2 max-w-4xl text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
              {title.title}
            </h1>

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
              <TitleCastAndRecs
                type={title.media_type}
                tmdbId={title.tmdb_id}
                titleName={title.title}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
