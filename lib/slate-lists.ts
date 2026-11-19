import "server-only";

import { cache } from "react";
import { getPublicProfile } from "@/lib/profiles";
import { getSlateListExtras, isListedSlateList } from "@/lib/slate-list-content";
import { SLATE_HOSTED } from "@/lib/public-mode";
import { supabase } from "@/lib/supabase";
import type { ListRow, TitleRow } from "@/lib/types";

/**
 * Lists made by Slate itself. They belong to one house account (the public
 * profile below) and every list that account owns is public at /l/<slug>.
 * Publish or update one with `npm run lists:publish -- content/slate-lists/<file>.json`.
 */
export const SLATE_LIST_USERNAME = "slate";

export interface SlateList {
  list: ListRow;
  titles: TitleRow[];
  curator: string;
  username: string;
}

export const getSlateList = cache(async (slug: string): Promise<SlateList | null> => {
  if (!SLATE_HOSTED || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug)) return null;
  const profile = await getPublicProfile(SLATE_LIST_USERNAME);
  if (!profile) return null;

  const { data: list, error } = await supabase
    .from("lists")
    .select("*")
    .eq("owner_id", profile.id)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!list) return null;

  const { data: rows, error: titlesError } = await supabase
    .from("list_titles")
    .select("title_id, position, titles(*)")
    .eq("list_id", (list as ListRow).id)
    .eq("owner_id", profile.id)
    .order("position", { ascending: true });
  if (titlesError) throw new Error(titlesError.message);

  const titles = (rows ?? []).flatMap((row) => {
    const embedded = row.titles as unknown as TitleRow | TitleRow[] | null;
    return embedded ? (Array.isArray(embedded) ? embedded : [embedded]) : [];
  });

  return {
    list: list as ListRow,
    titles,
    curator: profile.display_name,
    username: profile.username,
  };
});

/** The list that changes every week, shown first everywhere. */
export const WEEKLY_SLUG = "this-week";

export interface SlateListSummary {
  slug: string;
  name: string;
  description: string | null;
  /** TMDB backdrop path for the card. */
  backdropPath: string | null;
  createdAt: string;
}

/**
 * Every list made by Slate, for the hub and the home page: the weekly list
 * first, then newest first. Each card's picture is its first film's still.
 */
export const getSlateLists = cache(async (): Promise<SlateListSummary[]> => {
  if (!SLATE_HOSTED) return [];
  const profile = await getPublicProfile(SLATE_LIST_USERNAME);
  if (!profile) return [];

  const { data: lists, error } = await supabase
    .from("lists")
    .select("id, slug, name, description, created_at")
    .eq("owner_id", profile.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (lists ?? []) as (Pick<ListRow, "id" | "slug" | "name" | "description"> & { created_at: string })[];
  const summaries = await Promise.all(
    rows.map(async (row) => {
      const found = await getSlateList(row.slug);
      return {
        slug: row.slug,
        name: row.name,
        description: getSlateListExtras(row.slug).summary ?? row.description,
        backdropPath: found?.titles.find((title) => title.backdrop_path)?.backdrop_path ?? null,
        createdAt: row.created_at,
        titleCount: found?.titles.length ?? 0,
      };
    }),
  );
  return summaries
    .filter((list) => list.titleCount > 0 && isListedSlateList(list.slug))
    .sort((a, b) => Number(b.slug === WEEKLY_SLUG) - Number(a.slug === WEEKLY_SLUG))
    .map((list) => ({
      slug: list.slug,
      name: list.name,
      description: list.description,
      backdropPath: list.backdropPath,
      createdAt: list.createdAt,
    }));
});
