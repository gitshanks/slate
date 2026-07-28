import type { Metadata } from "next";
import { runDiscoverForIntent } from "@/lib/ai-chat";
import { savedAmong } from "@/lib/search";
import type { SearchIntent } from "@/lib/ai-search";
import { DiscoverView } from "@/components/discover-view";

export const metadata: Metadata = {
  title: "slate · AI search",
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
 * /discover prefetches the URL-intent grid server-side (for fresh / shared
 * links). DiscoverView then decides at runtime: if a live AI thread exists in
 * the shared store, it shows the conversation instead; otherwise this grid.
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

  const media = hasIntent ? await runDiscoverForIntent(intent) : [];
  const savedTmdbIds = await savedAmong(media.map((m) => m.id));

  return (
    <DiscoverView
      serverMedia={media}
      serverSaved={[...savedTmdbIds]}
      title={title}
      summary={hasIntent ? summarize(intent) : ""}
      hasIntent={hasIntent}
    />
  );
}
