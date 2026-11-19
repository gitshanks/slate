import Image from "next/image";
import Link from "next/link";
import { backdropUrl } from "@/lib/tmdb-image";
import { cn } from "@/lib/utils";
import type { SlateListSummary } from "@/lib/slate-lists";

/**
 * One list made by Slate as a picture card: its first film's still, its name
 * and one line. `featured` makes the wide card that spans the row.
 */
export function SlateListCard({
  list,
  featured = false,
  priority = false,
}: {
  list: SlateListSummary;
  featured?: boolean;
  priority?: boolean;
}) {
  const still = backdropUrl(list.backdropPath, "w1280");
  return (
    <Link
      href={`/l/${list.slug}`}
      className={cn(
        "group/card relative block aspect-[16/10] overflow-hidden rounded-[20px] bg-card transition-transform duration-300 ease-out motion-reduce:transition-none hoverable:hover:-translate-y-1",
        "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary",
        featured && "lg:col-span-2 lg:aspect-[21/8]",
      )}
    >
      {still ? (
        <Image
          src={still}
          alt=""
          fill
          priority={priority}
          sizes={featured ? "(min-width: 1024px) 1200px, 100vw" : "(min-width: 1024px) 600px, 100vw"}
          className="object-cover"
        />
      ) : null}
      <span aria-hidden className="absolute inset-0 bg-linear-to-b from-transparent from-35% to-background/90" />
      <span className="absolute inset-x-5 bottom-[18px] lg:inset-x-8 lg:bottom-7">
        <span
          className={cn(
            "block text-balance text-2xl font-bold leading-7 tracking-[-0.025em] text-white lg:text-[32px] lg:leading-9",
            featured && "lg:text-5xl lg:leading-[52px]",
          )}
        >
          {list.name}
        </span>
        {list.description ? (
          <span className="mt-1 block text-balance text-sm leading-5 text-white/80 lg:text-[17px] lg:leading-[26px]">
            {list.description}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
