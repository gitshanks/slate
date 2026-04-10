import { notFound } from "next/navigation";
import Image from "next/image";
import { Star } from "lucide-react";
import { supabase, type TitleRow } from "@/lib/supabase";
import { posterUrl, getTitleMeta } from "@/lib/tmdb";
import { BackdropHero } from "@/components/backdrop-hero";
import { StatusPill } from "@/components/status-pill";
import { StarRating } from "@/components/star-rating";
import { ReviewSheet } from "@/components/review-sheet";
import { RemoveButton } from "@/components/remove-button";
import { formatRuntime, formatYear } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TitleDetailPage(props: PageProps<"/title/[id]">) {
  const { id } = await props.params;

  const { data, error } = await supabase
    .from("titles")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) notFound();

  const title = data as TitleRow;
  const poster = posterUrl(title.poster_path, "w500");
  const year = formatYear(title.release_date);
  const runtime = formatRuntime(title.runtime);

  // Pull live TMDB rating + reviews (cached for 1h)
  const meta = await getTitleMeta(title.media_type, title.tmdb_id);

  return (
    <div className="-mx-4 -my-8 sm:-mx-6 sm:-my-10 lg:-mx-10 lg:-my-14">
      <BackdropHero path={title.backdrop_path} alt={title.title} />

      <div className="relative -mt-44 px-4 sm:-mt-48 sm:px-6 lg:px-10">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-[240px_1fr] md:gap-12">
          <div className="hidden md:block">
            <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/40">
              {poster && (
                <Image
                  src={poster}
                  alt={title.title}
                  fill
                  sizes="240px"
                  className="object-cover"
                />
              )}
            </div>

            {meta.vote_average != null && meta.vote_average > 0 && (
              <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
                  <span className="font-mono text-sm font-medium">
                    {meta.vote_average.toFixed(1)}
                  </span>
                  <span className="text-xs text-muted-foreground">/ 10</span>
                </div>
                {meta.vote_count != null && (
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {meta.vote_count.toLocaleString()} votes
                  </span>
                )}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
              {title.media_type === "movie" ? "Film" : "Series"}
              {year && <span> · {year}</span>}
              {runtime && <span> · {runtime}</span>}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
              {title.title}
            </h1>

            {meta.tagline && (
              <p className="mt-2 text-sm italic text-muted-foreground">
                {meta.tagline}
              </p>
            )}

            {/* Mobile: TMDB rating chip */}
            {meta.vote_average != null && meta.vote_average > 0 && (
              <div className="mt-3 inline-flex md:hidden items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5">
                <Star className="h-3.5 w-3.5 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
                <span className="font-mono text-xs font-medium">
                  {meta.vote_average.toFixed(1)}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  TMDB · {meta.vote_count?.toLocaleString() ?? 0}
                </span>
              </div>
            )}

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

            {title.overview && (
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-foreground/85">
                {title.overview}
              </p>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <StatusPill titleId={title.id} status={title.status} />
              <ReviewSheet
                titleId={title.id}
                titleName={title.title}
                initialRating={title.rating != null ? Number(title.rating) : null}
                initialReview={title.review}
              />
              <RemoveButton titleId={title.id} titleName={title.title} />
            </div>

            {(title.rating != null || title.review) && (
              <div className="mt-10 rounded-2xl border border-border bg-card p-6">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-mono">
                  Your review
                </p>
                {title.rating != null && (
                  <div className="mt-3 flex items-center gap-3">
                    <StarRating value={Number(title.rating)} readOnly size={22} />
                    <span className="font-mono text-sm text-muted-foreground">
                      {Number(title.rating).toFixed(1)} / 5
                    </span>
                  </div>
                )}
                {title.review && (
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">
                    {title.review}
                  </p>
                )}
              </div>
            )}

            {meta.reviews.length > 0 && (
              <div className="mt-12">
                <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
                  What people are saying
                </h2>
                <div className="mt-5 space-y-4">
                  {meta.reviews.map((r) => {
                    const rating = r.author_details?.rating ?? null;
                    const date = new Date(r.created_at).toLocaleDateString(
                      "en-US",
                      { year: "numeric", month: "short", day: "numeric" }
                    );
                    return (
                      <article
                        key={r.id}
                        className="rounded-2xl border border-border bg-card p-5"
                      >
                        <header className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-sm font-medium">
                              {r.author}
                            </span>
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
                        <p className="mt-3 line-clamp-6 whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
                          {r.content}
                        </p>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
