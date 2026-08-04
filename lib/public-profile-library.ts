import "server-only";

import { cache } from "react";
import { libraryClientForOwner } from "@/lib/library-db";
import { getPublicProfile } from "@/lib/profiles";
import type { TitleRow } from "@/lib/types";

/**
 * Resolve a title only when it belongs to a profile that is currently public.
 * Keeping both checks together prevents a guessed title id from exposing a
 * private library row.
 */
export const getPublicProfileTitle = cache(
  async (username: string, titleId: string) => {
    const profile = await getPublicProfile(username);
    if (!profile) return null;

    const { data, error } = await libraryClientForOwner(profile.id)
      .from("titles")
      .select("*")
      .eq("id", titleId)
      .maybeSingle();

    if (error || !data) return null;
    return { profile, title: data as TitleRow };
  }
);
