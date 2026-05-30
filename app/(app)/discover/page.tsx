import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { runDiscoverForIntent } from "@/lib/ai-chat";
import { savedAmong } from "@/lib/search";
import type { SearchIntent } from "@/lib/ai-search";
import { SearchResults } from "@/components/search-results";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = {
  title: "slate — AI search",
};

function pickStr(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

function pickNum(v: string | string[] | undefined): number | null {
  const s = pickStr(v);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const SORTS = ["popularity", "rating", "recent"] as const;

/** Concise structured summary of the intent for the page subtitle. */
function summarize(intent: SearchIntent): string {
  const parts: string[] = [];
  if (intent.media_type !== "both") parts.push(intent.media_type === "movie" ? "Films" : "Series");
  if (intent.genres.length > 0) parts.push(intent.genres.slice(0, 3).join(", "));
  if (intent.year_min || intent.year_max) {
    parts.push(`${intent.year_min ?? "…"}–${intent.year_max ?? "…"}`);
  }
  if (intent.sort_by === "rating") parts.push("highly rated");
  if (intent.sort_by === "recent") parts.push("recent");
  return parts.join(" · ");
}

/**
 * Full-page browse of an AI-search interpretation. The command-palette AI
 * chat parses your phrasing into a SearchIntent and passes it here in the URL;
 * we re-run the same `runDiscoverForIntent` the chat uses — no second LLM call,
 * and the page is shareable. Renders through SearchResults so it gets the
 * All / Films / Series filter for free.
 */
export default async function DiscoverPage(props: PageProps<"/discover">) {
  const sp = await props.searchParams;
  const mt = pickStr(sp.mt);
  const sort = pickStr(sp.sort);

  const intent: SearchIntent = {
    media_type: mt === "movie" || mt === "tv" ? mt : "both",
    genres: pickStr(sp.genres)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    year_min: pickNum(sp.ymin),
    year_max: pickNum(sp.ymax),
    query_text: pickStr(sp.q) || null,
    sort_by: (SORTS as readonly string[]).includes(sort)
      ? (sort as SearchIntent["sort_by"])
      : null,
    min_rating: pickNum(sp.minr),
    interpretation: "",
  };
  const title = pickStr(sp.title);

  const hasIntent =
    intent.media_type !== "both" ||
    intent.genres.length > 0 ||
    intent.year_min != null ||
    intent.year_max != null ||
    Boolean(intent.query_text) ||
    intent.sort_by != null;

  if (!hasIntent) {
    return (
      <EmptyState
        icon={<Sparkles className="h-6 w-6" />}
        title="Nothing to browse yet"
        description="Open ⌘K, switch to AI mode, and choose “Browse all” on a set of results."
      />
    );
  }

  const media = await runDiscoverForIntent(intent);
  const savedTmdbIds = await savedAmong(media.map((m) => m.id));
  const summary = summarize(intent);

  return (
    <div>
      <div className="mb-8">
        <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
          <Sparkles className="h-3 w-3" />
          AI search
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          {title || "Results"}
        </h1>
        {summary && <p className="mt-2 text-sm text-muted-foreground">{summary}</p>}
      </div>

      {media.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-6 w-6" />}
          title="No matches"
          description="Try a broader ask in AI mode."
        />
      ) : (
        <SearchResults
          library={[]}
          media={media}
          people={[]}
          savedTmdbIds={[...savedTmdbIds]}
        />
      )}
    </div>
  );
}
