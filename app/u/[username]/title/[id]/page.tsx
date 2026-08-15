import { Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Clock,
  Eye,
  Heart,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { BackdropHero } from "@/components/backdrop-hero";
import {
  ImdbBadge,
  MetacriticBadge,
  RottenTomatoesBadge,
} from "@/components/rating-icons";
import { RatingChip } from "@/components/rating-chip";
import { TitleDescription } from "@/components/title-description";
import { TrailerButton } from "@/components/trailer-button";
import { WatchProvidersButton } from "@/components/watch-providers-button";
import { getPublicProfileTitle } from "@/lib/public-profile-library";
import { getOmdbMetadata } from "@/lib/omdb";
import { formatPlotText } from "@/lib/plot-format";
import { getTitleMeta } from "@/lib/tmdb";
import { posterUrl as rawPosterUrl } from "@/lib/tmdb-image";
import {
  formatImdbRating,
  formatMetacriticScore,
  formatRtScore,
  formatRuntime,
  formatYear,
  metacriticSearchUrl,
  rottenTomatoesSearchUrl,
} from "@/lib/utils";

type Props = PageProps<"/u/[username]/title/[id]">;

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { username, id } = await props.params;
  const record = await getPublicProfileTitle(username, id);

  if (!record) {
    return { title: "Title not found · slate", robots: { index: false } };
  }

  const summary = formatPlotText(
    record.title.omdb_plot?.trim() ||
    (record.title.imdb_id
      ? (await getOmdbMetadata(record.title.imdb_id)).omdb_plot
      : null) ||
    record.title.overview,
  )?.replace(/\s+/g, " ");

  return {
    title: `${record.title.title} · ${record.profile.display_name}'s slate`,
    description:
      summary ||
      `See ${record.title.title} on ${record.profile.display_name}'s slate.`,
  };
}

export default async function PublicTitlePage(props: Props) {
  const { username, id } = await props.params;
  const searchParams = await props.searchParams;
  const record = await getPublicProfileTitle(username, id);
  if (!record) notFound();

  const { profile, title } = record;
  const summary =
    title.omdb_plot?.trim() ||
    (title.imdb_id
      ? (await getOmdbMetadata(title.imdb_id)).omdb_plot
      : null) ||
    title.overview;
  const meta = await getTitleMeta(title.media_type, title.tmdb_id).catch(
    () => null
  );
  const year = formatYear(title.release_date);
  const runtime = formatRuntime(title.runtime);
  const ambientBg = rawPosterUrl(title.poster_path, "w342");
  const imdbScore = formatImdbRating(title.imdb_rating);
  const rtScore = formatRtScore(title.rt_score);
  const mcScore = formatMetacriticScore(title.metacritic_score);
  const imdbUrl = title.imdb_id
    ? `https://www.imdb.com/title/${title.imdb_id}/`
    : null;
  const criticChip = rtScore
    ? {
        kind: "rt" as const,
        score: typeof title.rt_score === "number" ? title.rt_score : null,
        label: rtScore,
        href: rottenTomatoesSearchUrl(title.title),
      }
    : mcScore
      ? {
          kind: "mc" as const,
          score:
            typeof title.metacritic_score === "number"
              ? title.metacritic_score
              : null,
          label: mcScore,
          href: metacriticSearchUrl(title.title),
        }
      : null;
  const shelf =
    title.status === "watching"
      ? { label: "Watching", icon: Eye }
      : title.status === "watched"
        ? { label: "Watched", icon: Check }
        : { label: "Watchlist", icon: Clock };
  const profileHref = `/u/${profile.username}${
    searchParams.view === "shelf" ? "?view=shelf" : ""
  }`;
  const ShelfIcon = shelf.icon;
  const sentiment =
    title.rating === 3
      ? { label: "Loved", icon: Heart, className: "text-rose-400" }
      : title.rating === 2
        ? { label: "Liked", icon: ThumbsUp, className: "text-emerald-400" }
        : title.rating === 1
          ? {
              label: "Disliked",
              icon: ThumbsDown,
              className: "text-amber-400",
            }
          : null;
  const SentimentIcon = sentiment?.icon;

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 pb-16 pt-8 sm:px-6 sm:pt-10 lg:px-10 lg:pt-12">
        <div className="relative -mx-4 -mt-8 pb-20 sm:-mx-6 sm:-mt-10 lg:-mx-10 lg:-mt-12">
          {ambientBg ? (
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
          ) : null}

          <BackdropHero path={title.backdrop_path} alt={title.title} />

          <div className="relative z-10 px-4 pt-8 sm:px-6 sm:pt-10 lg:px-10 lg:pt-12">
            <Link
              href={profileHref}
              className="mb-8 inline-flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to {profile.display_name}&rsquo;s slate
            </Link>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-mono uppercase tracking-[0.08em] text-muted-foreground">
              {[
                runtime ? (
                  <span key="runtime" className="text-foreground/80">
                    {runtime}
                  </span>
                ) : null,
                year ? <span key="year">{year}</span> : null,
                imdbScore ? (
                  <RatingChip
                    key="imdb"
                    icon={<ImdbBadge className="h-3 w-auto" />}
                    label={imdbScore}
                    href={imdbUrl}
                  />
                ) : null,
                criticChip?.kind === "rt" ? (
                  <RatingChip
                    key="critic"
                    icon={
                      <RottenTomatoesBadge
                        score={criticChip.score}
                        className="h-3 w-auto"
                      />
                    }
                    label={criticChip.label}
                    href={criticChip.href}
                  />
                ) : null,
                criticChip?.kind === "mc" ? (
                  <RatingChip
                    key="critic"
                    icon={
                      <MetacriticBadge
                        score={criticChip.score}
                        className="h-3 w-auto"
                      />
                    }
                    label={criticChip.label}
                    href={criticChip.href}
                  />
                ) : null,
                title.genres?.[0] ? (
                  <span key="genre">{title.genres[0].name}</span>
                ) : null,
              ]
                .filter(Boolean)
                .map((node, index) => (
                  <Fragment key={index}>
                    {index > 0 ? (
                      <span aria-hidden className="opacity-40">
                        ·
                      </span>
                    ) : null}
                    {node}
                  </Fragment>
                ))}
            </div>

            <h1 className="mt-2 max-w-4xl text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
              {title.title}
            </h1>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-medium text-primary-foreground">
                <ShelfIcon className="h-3.5 w-3.5" />
                {shelf.label}
              </span>
              {sentiment && SentimentIcon ? (
                <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium">
                  <SentimentIcon
                    className={`h-3.5 w-3.5 ${sentiment.className}`}
                  />
                  {sentiment.label}
                </span>
              ) : null}
              {meta?.trailerKey ? (
                <TrailerButton
                  trailerKey={meta.trailerKey}
                  titleName={title.title}
                />
              ) : null}
              {meta?.watchProviders?.providers.length ? (
                <WatchProvidersButton
                  providers={meta.watchProviders.providers}
                  link={meta.watchProviders.link}
                  titleName={title.title}
                />
              ) : null}
            </div>

            <TitleDescription text={summary} />

            {title.review ? (
              <section className="mt-8 max-w-2xl rounded-2xl border border-border bg-card/80 p-6 backdrop-blur-sm">
                <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  {profile.display_name}&rsquo;s note
                </h2>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">
                  {title.review}
                </p>
              </section>
            ) : null}
          </div>
        </div>
    </main>
  );
}
