import type { Metadata } from "next";
import { Link2, Share2 } from "lucide-react";
import { LinkImporter } from "@/components/link-importer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "slate · Add from a link",
};

function pick(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SharePage(props: PageProps<"/share">) {
  const searchParams = await props.searchParams;
  const initialShare = {
    title: pick(searchParams.title),
    text: pick(searchParams.text),
    url: pick(searchParams.url),
  };
  const sharedIn = Boolean(
    initialShare.title?.trim() ||
      initialShare.text?.trim() ||
      initialShare.url?.trim(),
  );

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6 sm:mb-8">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
          {sharedIn ? <Share2 className="h-5 w-5" /> : <Link2 className="h-5 w-5" />}
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {sharedIn ? "Shared with Slate" : "Add from a link"}
        </p>
        <h1 className="mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">
          {sharedIn ? "Keep the good part" : "Saw something worth watching?"}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Slate reads the recommendation, finds the films and shows on TMDB,
          and waits for you to confirm the matches before saving anything.
        </p>
      </header>

      <LinkImporter initialShare={initialShare} autoStart={sharedIn} />

      <p className="mt-4 px-1 text-xs leading-relaxed text-muted-foreground">
        On an installed Android or ChromeOS app, choose Slate directly from
        the system share sheet. Everywhere else, copy the link and paste it
        here.
      </p>
    </div>
  );
}
