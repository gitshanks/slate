import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { addTitle } from "@/lib/actions";
import { EmptyState } from "@/components/empty-state";
import { Share2 } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Entry point for "Send to slate" — from PWA share targets, Apple Shortcuts,
 * bookmarklets, or any external deep link.
 *
 * Supports:
 *   /share?url=https://www.themoviedb.org/movie/603
 *   /share?url=https://www.themoviedb.org/tv/1399
 *   /share?title=...&text=...
 *
 * TMDB URLs auto-add to the library and forward to the title page.
 * Anything else falls through to a manual search prompt.
 */

const TMDB_URL_RE =
  /themoviedb\.org\/(movie|tv)\/(\d+)/i;

function pick(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function SharePage(props: PageProps<"/share">) {
  const sp = await props.searchParams;
  const url = pick(sp.url);
  const title = pick(sp.title);
  const text = pick(sp.text);

  // 1. TMDB URL — extract id + media_type, add, redirect to detail page
  const fromUrl = url ?? text ?? title ?? "";
  const tmdbMatch = fromUrl.match(TMDB_URL_RE);
  if (tmdbMatch) {
    const mediaType = tmdbMatch[1].toLowerCase() as "movie" | "tv";
    const tmdbId = Number(tmdbMatch[2]);
    if (Number.isFinite(tmdbId)) {
      try {
        const row = await addTitle({ tmdbId, mediaType });
        if (row?.id) redirect(`/title/${row.id}`);
      } catch {
        // fall through to manual prompt
      }
    }
  }

  // 2. Anything else — show a lightweight landing that lets the user
  //    open the command palette pre-filled.
  const hint = title || text || url || "";

  return (
    <div className="mx-auto max-w-xl py-16">
      <EmptyState
        icon={<Share2 className="h-6 w-6" />}
        title="Couldn't auto-detect a title"
        description={
          hint
            ? `We couldn't turn "${hint}" into a TMDB entry automatically. Press ⌘K and search for it.`
            : "Send a TMDB URL to /share?url=… and we'll add it for you. Or press ⌘K to search."
        }
        action={
          <Button asChild variant="outline">
            <Link href="/">Back to slate</Link>
          </Button>
        }
      />
    </div>
  );
}
