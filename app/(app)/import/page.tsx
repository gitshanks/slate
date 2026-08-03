import type { Metadata } from "next";
import { ImportWidget } from "@/components/import-widget";
import { LinkImporter } from "@/components/link-importer";

export const metadata: Metadata = {
  title: "slate · Import",
};

export default function ImportPage() {
  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-6 sm:mb-10">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
          Import
        </p>
        <h1 className="mt-1 text-4xl font-semibold tracking-tight">
          Bring it into Slate
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Add recommendations from a link, or move an existing watch history
          over from Letterboxd or Trakt.
        </p>
      </div>

      <section>
        <p className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
          From anywhere on the web
        </p>
        <h2 className="text-xl font-semibold tracking-tight">Add from a link</h2>
        <p className="mb-4 mt-1 text-sm leading-relaxed text-muted-foreground">
          Paste a public Instagram, YouTube, TikTok, article, IMDb, or TMDB
          link. Slate finds the movies and shows mentioned inside it.
        </p>
        <LinkImporter />
      </section>

      <section className="mt-12 border-t border-border/70 pt-10 sm:mt-16 sm:pt-12">
        <p className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
          From another service
        </p>
        <h2 className="text-xl font-semibold tracking-tight">Import a CSV</h2>
        <p className="mb-4 mt-1 text-sm leading-relaxed text-muted-foreground">
          Slate matches each row on TMDB and saves it as watched. Safe to
          re-import; titles already in your library keep their state.
        </p>
        <ImportWidget />
      </section>

      {/* Where to find your CSV — primary helper, not a footnote, so it sits
          right under the widget at the same visual weight. */}
      <section className="mt-10 sm:mt-12">
        <p className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
          Exporting from
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <ExportHint
            service="Letterboxd"
            href="https://letterboxd.com/settings/data/"
            steps="Settings → Data → Export your data → unzip → upload watched.csv"
          />
          <ExportHint
            service="Trakt"
            href="https://trakt.tv/users/settings"
            steps="Settings → Exports → request a CSV of your watched history"
          />
        </div>
      </section>
    </div>
  );
}

function ExportHint({
  service,
  href,
  steps,
}: {
  service: string;
  href: string;
  steps: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="block rounded-xl border border-border/60 bg-card/40 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-card"
    >
      <span className="text-sm font-medium text-foreground">
        {service} →
      </span>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {steps}
      </p>
    </a>
  );
}
