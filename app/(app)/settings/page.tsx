import type { Metadata } from "next";
import Link from "next/link";
import { Puzzle, FileCode } from "lucide-react";
import { getOrCreateImportToken } from "@/lib/slate-token";
import { SettingsTokenCard } from "@/components/settings-token-card";

export const metadata: Metadata = {
  title: "slate — Settings",
};

// Loads lazily on first visit — this is where the token is generated if
// it doesn't exist yet. No caching: we want the freshest value every time
// in case the user just rotated the token in another tab.
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const token = await getOrCreateImportToken();

  return (
    <div className="max-w-2xl">
      <div className="mb-10">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
          Configuration
        </p>
        <h1 className="mt-1 text-4xl font-semibold tracking-tight">Settings</h1>
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium">Browser extension</h2>
        <SettingsTokenCard initialToken={token} />
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium">Install the extension</h2>
        <div className="space-y-3 rounded-xl border border-border bg-card/40 p-5 text-sm">
          <p className="text-muted-foreground">
            The Slate extension reads your already-signed-in Netflix, Prime
            Video, Hulu, and Disney+ tabs and pushes your watch history here.
            It ships as an unpacked Chrome extension — not in the Web Store yet.
          </p>
          <ol className="space-y-2 pl-5 list-decimal text-muted-foreground">
            <li>
              Clone or download the repo and run{" "}
              <code className="rounded bg-background/60 px-1.5 py-0.5 font-mono text-xs">
                cd extension && npm install && npm run build
              </code>
              .
            </li>
            <li>
              Open{" "}
              <code className="rounded bg-background/60 px-1.5 py-0.5 font-mono text-xs">
                chrome://extensions
              </code>{" "}
              and enable <em>Developer mode</em> (top-right toggle).
            </li>
            <li>
              Click <em>Load unpacked</em> and choose{" "}
              <code className="rounded bg-background/60 px-1.5 py-0.5 font-mono text-xs">
                extension/dist/
              </code>
              .
            </li>
            <li>Open the Slate icon in your toolbar, paste the token above.</li>
            <li>
              Visit any supported service&apos;s history page (e.g.{" "}
              <code className="rounded bg-background/60 px-1.5 py-0.5 font-mono text-xs">
                netflix.com/viewingactivity
              </code>
              ) and click <em>Sync now</em>.
            </li>
          </ol>
          <div className="flex flex-wrap gap-2 pt-2">
            <a
              href="https://developer.chrome.com/docs/extensions/mv3/getstarted/extensions-101/#load-unpacked"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium transition-colors hover:bg-card/80"
            >
              <Puzzle className="h-3.5 w-3.5" />
              Chrome guide
            </a>
            <Link
              href="/import"
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium transition-colors hover:bg-card/80"
            >
              <FileCode className="h-3.5 w-3.5" />
              Or paste a CSV
            </Link>
          </div>
        </div>
      </section>

      <section className="text-xs text-muted-foreground">
        <p>
          Slate is single-user. This token is the only credential the
          extension uses to post to your instance. Regenerating it above will
          immediately invalidate every paired browser.
        </p>
      </section>
    </div>
  );
}
