import { notFound } from "next/navigation";
import Image from "next/image";
import { supabase, type TitleRow } from "@/lib/supabase";
import { posterUrl } from "@/lib/tmdb";
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

  return (
    <div className="-mx-6 -my-10">
      <BackdropHero path={title.backdrop_path} alt={title.title} />

      <div className="relative -mt-48 px-6">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-10 md:grid-cols-[220px_1fr]">
          <div className="hidden md:block">
            <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/40">
              {poster && (
                <Image
                  src={poster}
                  alt={title.title}
                  fill
                  sizes="220px"
                  className="object-cover"
                />
              )}
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
              {title.media_type === "movie" ? "Film" : "Series"}
              {year && <span> · {year}</span>}
              {runtime && <span> · {runtime}</span>}
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
              {title.title}
            </h1>

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
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-foreground/80">
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
          </div>
        </div>
      </div>
    </div>
  );
}
