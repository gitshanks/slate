import type { Metadata } from "next";
import { ImportWidget } from "@/components/import-widget";

export const metadata: Metadata = {
  title: "slate · Import",
};

export default function ImportPage() {
  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="mb-6 sm:mb-10">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
          Import
        </p>
        <h1 className="mt-1 text-4xl font-semibold tracking-tight">
          Bring your library
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Drop a Letterboxd or Trakt CSV. Slate matches each row on TMDB and
          saves it as watched. Safe to re-import — already-saved titles keep
          their state.
        </p>
      </div>

      <ImportWidget />

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
