import bond from "@/content/slate-lists/7-for-007.json";
import thanksgiving from "@/content/slate-lists/thanksgiving-peace-treaty.json";
import gotThereFirst from "@/content/slate-lists/got-there-first.json";
import showsThisWeek from "@/content/slate-lists/shows-this-week.json";
import thisWeek from "@/content/slate-lists/this-week.json";

/**
 * What a list made by Slate shows beyond its films. The films themselves live
 * in the database (published by scripts/publish-slate-list.mjs); the page's
 * extras are read straight from the same list files, so they need no column.
 * Add a list's file to FILES when it should carry extras.
 */
export interface SlateListItemExtra {
  /** Short and shown large at the right of the row, such as a score. */
  value?: string;
  /** One line under the title, such as who the film is for. */
  line?: string;
}

export interface SlateListExtras {
  description?: string;
  /** One line for the list's card on the hub and the home page. */
  summary?: string;
  /** One small line under the list, such as how a score is worked out. */
  note?: string;
  /** TMDB backdrop path for the still at the top; the first film's is used when absent. */
  hero?: string;
  /** CSS object-position for that still. */
  heroPosition?: string;
  /** Keyed by `${mediaType}:${tmdbId}`. */
  items: Record<string, SlateListItemExtra>;
}

interface ListFile {
  slug: string;
  description?: string | null;
  summary?: string | null;
  note?: string | null;
  hero?: string | null;
  heroPosition?: string | null;
  titles: { tmdbId: number; mediaType?: string; value?: string | number | null; line?: string | null }[];
}

const FILES = [bond, thanksgiving, thisWeek, showsThisWeek, gotThereFirst] as ListFile[];

const EXTRAS = new Map<string, SlateListExtras>(
  FILES.map((file) => [
    file.slug,
    {
      description: file.description ?? undefined,
      summary: file.summary ?? undefined,
      note: file.note ?? undefined,
      hero: file.hero ?? undefined,
      heroPosition: file.heroPosition ?? undefined,
      items: Object.fromEntries(
        file.titles
          .filter((title) => title.value != null || title.line != null)
          .map((title) => [
            `${title.mediaType === "tv" ? "tv" : "movie"}:${title.tmdbId}`,
            {
              value: title.value != null ? String(title.value) : undefined,
              line: title.line ?? undefined,
            },
          ]),
      ),
    },
  ]),
);

export function getSlateListExtras(slug: string): SlateListExtras {
  return EXTRAS.get(slug) ?? { items: {} };
}

/** Only lists with a file here appear on the hub and the home page. */
export function isListedSlateList(slug: string): boolean {
  return EXTRAS.has(slug);
}
