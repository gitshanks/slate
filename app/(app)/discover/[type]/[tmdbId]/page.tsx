import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import {
  getMovie,
  getTv,
  getTitleMeta,
  type TmdbMovieDetail,
  type TmdbTvDetail,
} from "@/lib/tmdb";
import { getOmdbRatings } from "@/lib/omdb";
import { posterUrl as rawPosterUrl } from "@/lib/tmdb-image";
import { supabase } from "@/lib/supabase";
import { BackdropHero } from "@/components/backdrop-hero";
import { TrailerButton } from "@/components/trailer-button";
import { WatchProvidersButton } from "@/components/watch-providers-button";
import { TmdbRail } from "@/components/tmdb-rail";
import { CastRail } from "@/components/cast-rail";
import { AddStatusDropdown } from "@/components/add-status-dropdown";
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

// NOT force-dynamic: it would flip every TMDB/OMDB fetch to no-store (see
// lib/tmdb.ts) and re-fetch on every crawl. The page still renders
// dynamically via params + the per-visitor demo cookie; TMDB/OMDB data is
// served from the Data Cache.

export default async function DiscoverTitlePage(
  props: PageProps<"/discover/[type]/[tmdbId]">
) {
  const { type, tmdbId: tmdbIdStr } = await props.params;
  if (type !== "movie" && type !== "tv") notFound();
  const tmdbId = Number(tmdbIdStr);
  if (!Number.isFinite(tmdbId) || tmdbId <= 0) notFound();

  // Fetch TMDB detail + meta, and check for an existing library row, in parallel.
  async function fetchExisting() {
    try {
      const { data } = await supabase
        .from("titles")
        .select("id, status")
        .eq("tmdb_id", tmdbId)
        .eq("media_type", type)
        .maybeSingle();
      return data as { id: string; status: string } | null;
    } catch {
      return null;
    }
  }
  const [detail, meta, existing] = await Promise.all([
    (type === "movie" ? getMovie(tmdbId) : getTv(tmdbId)).catch(() => null),
    getTitleMeta(type, tmdbId),
    fetchExisting(),
  ]);

  if (!detail) notFound();

  const titleName =
    type === "movie"
      ? (detail as TmdbMovieDetail).title
      : (detail as TmdbTvDetail).name;
  const releaseDate =
    type === "movie"
      ? (detail as TmdbMovieDetail).release_date
      : (detail as TmdbTvDetail).first_air_date;
  const runtimeMinutes =
    type === "movie"
      ? (detail as TmdbMovieDetail).runtime
      : (detail as TmdbTvDetail).episode_run_time?.[0] ?? null;

  const ambientBg = rawPosterUrl(detail.poster_path, "w342");
  const genres: { id: number; name: string }[] = detail.genres ?? [];
  const year = formatYear(releaseDate);
  const runtime = formatRuntime(runtimeMinutes);
  const imdbId = detail.imdb_id ?? null;
  const imdbUrl = imdbId ? `https://www.imdb.com/title/${imdbId}/` : null;
  // One title preview = one OMDB lookup. Cheap, and the user is about to add it.
  const omdb = imdbId
    ? await getOmdbRatings(imdbId)
    : { imdb_rating: null, rt_score: null, metacritic_score: null };
  const imdbScore = formatImdbRating(omdb.imdb_rating);
  const rtScore = formatRtScore(omdb.rt_score);
  const mcScore = formatMetacriticScore(omdb.metacritic_score);
  const criticChip = rtScore
    ? ({
        kind: "rt" as const,
        score: typeof omdb.rt_score === "number" ? omdb.rt_score : null,
        label: rtScore,
        href: rottenTomatoesSearchUrl(titleName),
      })
    : mcScore
      ? ({
          kind: "mc" as const,
          score:
            typeof omdb.metacritic_score === "number"
              ? omdb.metacritic_score
              : null,
          label: mcScore,
          href: metacriticSearchUrl(titleName),
        })
      : null;

  return (
    <div className="relative -mx-4 -my-8 sm:-mx-6 sm:-my-10 lg:-mx-10 lg:-my-14 pb-20">
      {/* Ambient glow from poster colors */}
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

      <BackdropHero path={detail.backdrop_path} alt={titleName} />

      <div className="relative z-10 pt-8 px-4 sm:pt-10 sm:px-6 lg:pt-14 lg:px-10">
        <div>

          <div>
            {/* Primary meta — type · year · runtime */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-mono uppercase tracking-[0.08em] text-muted-foreground">
              <span className="text-foreground/80">
                {type === "movie" ? "Film" : "Series"}
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

            <h1 className="mt-2 max-w-4xl text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
              {titleName}
            </h1>

            {/* Genre chips + rating chips */}
            {(genres.length > 0 || imdbScore || criticChip) && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {genres.map((g) => (
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

            {meta.tagline && (
              <p className="mt-2 text-sm italic text-muted-foreground">
                {meta.tagline}
              </p>
            )}

            {meta.directedBy.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground font-mono">
                {type === "movie" ? "Directed by" : "Created by"}{" "}
                <span className="text-foreground">
                  {meta.directedBy.join(", ")}
                </span>
              </p>
            )}

            {/* Action row: Add or Already saved · trailer · providers */}
            <div className="mt-6 flex flex-wrap items-center gap-2">
              {existing ? (
                <Link
                  href={`/title/${existing.id}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                >
                  Already in your library
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <AddStatusDropdown tmdbId={tmdbId} mediaType={type} />
              )}
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
            </div>

            {detail.overview && (
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-foreground/85">
                {detail.overview}
              </p>
            )}

            {meta.cast.length > 0 && <CastRail cast={meta.cast} />}

            {meta.recommendations.length > 0 && (
              <TmdbRail
                title={`If you liked ${titleName}…`}
                items={meta.recommendations}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
