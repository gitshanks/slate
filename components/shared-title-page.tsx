import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Film } from "lucide-react";
import { SharedTitleActions } from "@/components/shared-title-actions";
import { TrailerButton } from "@/components/trailer-button";
import { posterUrl, backdropUrl } from "@/lib/tmdb-image";
import { APP_ROOT } from "@/lib/public-mode";
import type { ShareableTitle } from "@/lib/title-sharing";
import styles from "./title-sharing.module.css";

export function SharedTitlePage({ title, trailerKey }: {
  title: ShareableTitle & { overview: string | null; genres: { id: number; name: string }[] | null };
  trailerKey: string | null;
}) {
  const poster = posterUrl(title.poster_path, "w500");
  const backdrop = backdropUrl(title.backdrop_path, "w1280");
  const meta = [title.media_type === "movie" ? "Film" : "Series", title.release_date?.slice(0, 4), ...(title.genres?.slice(0, 2).map((genre) => genre.name) ?? [])].filter(Boolean);

  return (
    <main className={styles.page}>
      {backdrop ? <div className={styles.heroBackdrop} aria-hidden><Image src={backdrop} alt="" fill sizes="100vw" loading="eager" className="object-cover object-top" /></div> : null}
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-6 sm:px-8 sm:py-8">
        <Link href="/" aria-label="Slate home" className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
          <Image src="/brand/logo-light.svg" alt="slate" width={72} height={20} className="hidden dark:block" />
          <Image src="/brand/logo-dark.svg" alt="slate" width={72} height={20} className="dark:hidden" />
        </Link>
        <Link href={APP_ROOT} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">Open my slate <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /></Link>
      </header>
      <div className={styles.content}>
        <div className={styles.pagePoster}>
          <Film className="h-9 w-9 text-muted-foreground" aria-hidden />
          {poster ? <Image src={poster} alt={`${title.title} poster`} fill sizes="(max-width: 639px) 144px, 240px" loading="eager" className="object-cover" /> : null}
        </div>
        <div className="min-w-0">
          <h1 className={styles.heading}>{title.title}</h1>
          <p className="mt-4 text-xs leading-6 text-muted-foreground">{meta.join(" · ")}</p>
          {trailerKey ? <TrailerButton trailerKey={trailerKey} titleName={title.title} source="shared_title" className="mt-4 inline-flex h-10 items-center gap-2 rounded-full border border-border bg-background/60 px-4 text-xs font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring" /> : null}
          <SharedTitleActions title={title} />
          {title.overview ? <p className="mt-7 max-w-[60ch] text-sm leading-7 text-foreground/75">{title.overview}</p> : null}
        </div>
      </div>
      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-border/60 px-6 py-6 text-[11px] text-muted-foreground sm:px-8">
        <Link href="/" className="hover:text-foreground">Good recommendations, kept.</Link>
        <div className="flex gap-5"><a href={`https://www.themoviedb.org/${title.media_type}/${title.tmdb_id}`} target="_blank" rel="noreferrer" className="hover:text-foreground">Details from TMDB</a><Link href="/privacy" className="hover:text-foreground">Privacy</Link></div>
      </footer>
    </main>
  );
}
