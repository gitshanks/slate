import "server-only";

import { cache } from "react";
import { getPublicProfile } from "@/lib/profiles";
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
