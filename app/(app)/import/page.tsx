import type { Metadata } from "next";
import Link from "next/link";
import { Download, ExternalLink } from "lucide-react";
import { ImportWidget } from "@/components/import-widget";

export const metadata: Metadata = {
  title: "slate — Import",
};

// Server-only page shell. The three-phase form lives in the client widget;
// everything on this page around it is static.
export default function ImportPage() {
  return (
    <div>
      <div className="mb-10 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
            Bring it with you
          </p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight">
            Import watch history
          </h1>
        </div>
        <Link
          href="/settings"
          className="hidden items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
        >
          Slate extension
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      <div className="mb-6 rounded-xl border border-border/60 bg-card/30 p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-background">
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">Paste or drop a CSV</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Works with Netflix viewing activity, Letterboxd diary, IMDb list,
              Trakt JSON exports, or a plain list of titles — one per line.
              Seasons and episodes collapse into a single show row.
            </p>
          </div>
        </div>
      </div>

      <ImportWidget />

      <div className="mt-10 border-t border-border/60 pt-6 text-xs text-muted-foreground">
        <p className="mb-1 uppercase tracking-wider font-mono text-[10px]">
          One-click sync
        </p>
        <p>
          For Netflix, Prime Video, Hulu, and Disney+, install the{" "}
          <Link
            href="/settings"
            className="underline-offset-2 hover:text-foreground hover:underline"
          >
            Slate browser extension
          </Link>{" "}
          — it signs in as you, reads your watch history, and pushes it here
          with one click.
        </p>
      </div>
    </div>
  );
}
