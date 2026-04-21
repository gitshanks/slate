import type { Metadata } from "next";
import { ImportWidget } from "@/components/import-widget";

export const metadata: Metadata = {
  title: "slate — Import",
};

export default function ImportPage() {
  return (
    <div className="max-w-2xl">
      <div className="mb-10 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
            Import
          </p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight">
            Bring your library
          </h1>
        </div>
      </div>

      <p className="mb-8 text-sm text-muted-foreground">
        Move over from{" "}
        <strong className="text-foreground">Letterboxd</strong> or{" "}
        <strong className="text-foreground">Trakt</strong> in one go. Drop your
        export CSV and Slate matches each row on TMDB and saves it as watched.
        Re-importing is safe — titles already in your library keep their state.
      </p>

      <ImportWidget />

      <div className="mt-10 space-y-4 text-xs text-muted-foreground">
        <p className="font-mono uppercase tracking-[0.15em]">How to export</p>
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
      </div>
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
    <div className="rounded-xl border border-border/60 bg-card/40 px-4 py-3">
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="text-sm font-medium text-foreground transition-colors hover:text-primary"
      >
        {service} →
      </a>
      <p className="mt-1 leading-relaxed">{steps}</p>
    </div>
  );
}
