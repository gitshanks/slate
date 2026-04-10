"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { cn, formatYear } from "@/lib/utils";
import { posterUrl } from "@/lib/tmdb-image";
import type { TitleRow } from "@/lib/supabase";
import { Star } from "lucide-react";

interface PosterCardProps {
  title: Pick<
    TitleRow,
    "id" | "title" | "poster_path" | "release_date" | "media_type" | "rating"
  >;
  index?: number;
  priority?: boolean;
}

export function PosterCard({ title, index = 0, priority }: PosterCardProps) {
  const src = posterUrl(title.poster_path, "w500");
  const year = formatYear(title.release_date);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: Math.min(index * 0.03, 0.4),
        duration: 0.4,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
      whileHover={{ y: -4 }}
      className="group"
    >
      <Link
        href={`/title/${title.id}`}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl"
      >
        <div
          className={cn(
            "relative aspect-[2/3] overflow-hidden rounded-xl",
            "bg-card hairline",
            "transition-shadow duration-300",
            "group-hover:shadow-[0_24px_60px_-20px_hsl(var(--primary)/0.35)]"
          )}
        >
          {src ? (
            <Image
              src={src}
              alt={title.title}
              fill
              priority={priority}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 200px"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
              {title.title}
            </div>
          )}

          {/* Bottom gradient + meta on hover */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 opacity-0 translate-y-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
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
      </Link>
    </motion.div>
  );
}
