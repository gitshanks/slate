import Image from "next/image";
import { notFound } from "next/navigation";
import { getPersonDetail, getPersonCredits } from "@/lib/tmdb";
import { profileUrl } from "@/lib/tmdb-image";
import { TmdbRail } from "@/components/tmdb-rail";
import { BackButton } from "@/components/back-button";
import type { TmdbSearchResult } from "@/lib/tmdb";

export const revalidate = 3600;

export default async function PersonPage(props: PageProps<"/person/[id]">) {
  const { id } = await props.params;
  const personId = Number(id);
  if (!Number.isFinite(personId)) notFound();

  const [person, credits] = await Promise.all([
    getPersonDetail(personId).catch(() => null),
    getPersonCredits(personId).catch(() => []),
  ]);

  if (!person) notFound();

  const photo = profileUrl(person.profile_path, "w342");
  const birthYear = person.birthday ? person.birthday.slice(0, 4) : null;

  // Map combined credits to the shape TmdbRail expects.
  const knownFor: TmdbSearchResult[] = credits.map((c) => ({
    id: c.id,
    media_type: c.media_type,
    title: c.title,
    name: c.name,
    poster_path: c.poster_path,
    backdrop_path: c.backdrop_path,
    release_date: c.release_date,
    first_air_date: c.first_air_date,
    vote_average: c.vote_average,
  }));

  return (
    <div className="-mx-4 -my-5 sm:-mx-6 sm:-my-6 lg:-mx-10 lg:-my-8 pb-20">
      <div className="px-4 pt-6 sm:px-6 lg:px-10">
        <BackButton />
      </div>

      <div className="px-4 pt-8 sm:px-6 lg:px-10">
        <div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-[220px_1fr] md:gap-12">
            {/* Profile photo */}
            <div className="flex justify-center md:justify-start">
              <div className="relative w-48 shrink-0 overflow-hidden rounded-2xl border border-border bg-card shadow-lg md:w-full">
                <div className="aspect-[2/3] w-full">
                  {photo ? (
                    <Image
                      src={photo}
                      alt={person.name}
                      fill
                      sizes="(max-width: 768px) 192px, 220px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted">
                      <span className="text-4xl font-semibold text-muted-foreground">
                        {person.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Info */}
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
                {person.known_for_department}
                {birthYear && <span> · b. {birthYear}</span>}
                {person.place_of_birth && (
                  <span> · {person.place_of_birth}</span>
                )}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
                {person.name}
              </h1>

              {person.biography && (
                <p className="mt-6 max-w-2xl text-base leading-relaxed text-foreground/80 line-clamp-8">
                  {person.biography}
                </p>
              )}
            </div>
          </div>

          {/* Known for rail */}
          {knownFor.length > 0 && (
            <div className="-mx-4 sm:-mx-6 lg:-mx-10">
              <div className="px-4 sm:px-6 lg:px-10">
                <TmdbRail title="Known for" items={knownFor} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
