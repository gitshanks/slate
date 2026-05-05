import Image from "next/image";

export function LandingFooter() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-5 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex items-center gap-3">
          <Image
            src="/brand/logo-light.svg"
            alt="Slate"
            width={48}
            height={13}
            className="hidden h-[13px] w-auto opacity-70 dark:block"
          />
          <Image
            src="/brand/logo-dark.svg"
            alt="Slate"
            width={48}
            height={13}
            className="h-[13px] w-auto opacity-70 dark:hidden"
          />
          <span>· MIT licensed · single-user by design</span>
        </div>
        <p className="max-w-md text-pretty leading-relaxed">
          This product uses the TMDB API but is not endorsed or certified by
          TMDB. Poster artwork served from TMDB's CDN.
        </p>
      </div>
    </footer>
  );
}
