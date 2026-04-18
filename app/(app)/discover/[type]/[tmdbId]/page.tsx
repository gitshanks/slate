import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Plus, Star } from "lucide-react";
import {
  getMovie,
  getTv,
  getTitleMeta,
  type TmdbMovieDetail,
  type TmdbTvDetail,
} from "@/lib/tmdb";
import { posterUrl as rawPosterUrl } from "@/lib/tmdb-image";
import { supabase } from "@/lib/supabase";
import { BackdropHero } from "@/components/backdrop-hero";
import { TrailerButton } from "@/components/trailer-button";
import { WatchProvidersButton } from "@/components/watch-providers-button";
import { TmdbRail } from "@/components/tmdb-rail";
import { CastRail } from "@/components/cast-rail";
import { addTitleFromPreview } from "@/lib/actions";
import { formatRuntime, formatTmdbScore, formatYear } from "@/lib/utils";

export const dynamic = "force-dynamic";

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
  const tmdbUrl = `https://www.themoviedb.org/${type}/${tmdbId}`;
  const userScore = formatTmdbScore(meta.vote_average);

  return (
    <div className="relative -mx-4 -my-8 sm:-mx-6 sm:-my-10 lg:-mx-10 lg:-my-14 pb-20 overflow-x-hidden">
      {/* Ambient glow from poster colors */}
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

      <BackdropHero path={detail.backdrop_path} alt={titleName} />

      <div className="relative z-10 pt-8 px-4 sm:pt-10 sm:px-6 lg:pt-14 lg:px-10">
        <div>

          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
              {type === "movie" ? "Film" : "Series"}
              {year && <span> · {year}</span>}
              {runtime && <span> · {runtime}</span>}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
              {titleName}
            </h1>

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

            {/* TMDB chip + genres */}
            {(userScore || genres.length > 0) && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {userScore && (
                  <a
                    href={tmdbUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 transition-colors hover:border-primary/40"
                  >
                    <Star className="h-3 w-3 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
                    <span className="font-mono text-[11px] font-medium">{userScore}</span>
                    <span className="text-[10px] text-muted-foreground">TMDB</span>
                  </a>
                )}
                {genres.map((g) => (
                  <span
                    key={g.id}
                    className="inline-flex items-center rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground"
                  >
                    {g.name}
                  </span>
                ))}
              </div>
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
                <form action={addTitleFromPreview}>
                  <input type="hidden" name="tmdbId" value={tmdbId} />
                  <input type="hidden" name="mediaType" value={type} />
                  <button
                    type="submit"
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add to watchlist
                  </button>
                </form>
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
