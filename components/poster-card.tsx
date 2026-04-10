import Link from "next/link";
import Image from "next/image";
import { cn, formatYear } from "@/lib/utils";
import { posterUrl } from "@/lib/tmdb-image";
import type { TitleRow } from "@/lib/supabase";
import { Star } from "lucide-react";

interface PosterCardProps {
  title: Pick<
    TitleRow,
    "id" | "title" | "poster_path" | "release_date" | "media_type" | "rating"
  >;
  priority?: boolean;
}

export function PosterCard({ title, priority }: PosterCardProps) {
  const src = posterUrl(title.poster_path, "w500");
  const year = formatYear(title.release_date);

  return (
    <Link
      href={`/title/${title.id}`}
      prefetch
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl will-change-transform"
    >
      <div
        className={cn(
          "relative aspect-[2/3] overflow-hidden rounded-xl",
          "bg-card hairline",
          "transition-all duration-200 ease-out",
          "group-hover:-translate-y-1 group-hover:shadow-[0_24px_60px_-20px_hsl(var(--primary)/0.35)]"
        )}
      >
        {src ? (
          <Image
            src={src}
            alt={title.title}
            fill
            priority={priority}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 240px"
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            {title.title}
          </div>
        )}

        {/* Bottom gradient + meta on hover */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/30 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 opacity-0 translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0">
          <p className="text-sm font-medium text-white line-clamp-2 leading-snug">
            {title.title}
          </p>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-white/70 font-mono">
            <span className="uppercase tracking-wider">{title.media_type}</span>
            {year && <span>· {year}</span>}
          </div>
        </div>

        {/* Personal rating chip */}
        {title.rating != null && (
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/70 backdrop-blur px-2 py-1 text-[11px] font-medium text-white">
            <Star className="h-3 w-3 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
            {Number(title.rating).toFixed(1)}
          </div>
        )}
      </div>

      {/* Always-visible title under poster on mobile, hidden on desktop where hover reveals */}
      <div className="mt-2 px-0.5 sm:hidden">
        <p className="text-xs font-medium text-foreground line-clamp-1">{title.title}</p>
        {year && <p className="text-[10px] text-muted-foreground font-mono">{year}</p>}
      </div>
    </Link>
  );
}
