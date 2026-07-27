import "server-only";

import { cache } from "react";
import { supabase } from "@/lib/supabase";
import { slugify } from "@/lib/utils";

export interface ProfileRow {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

interface GoogleIdentity {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

function usernameFor(identity: GoogleIdentity): string {
  const emailStem = identity.email.split("@")[0] ?? "";
  const nameStem = identity.name ?? "";
  const base =
    (slugify(emailStem) || slugify(nameStem) || "viewer")
      .replace(/_/g, "-")
      .replace(/^-+|-+$/g, "") || "viewer";
  const suffix = identity.id.replace(/[^a-z0-9]/gi, "").slice(-10).toLowerCase();
  return `${base.slice(0, 19)}-${suffix || "slate"}`;
}

/**
 * Seed a durable public profile from Google the first time an account signs
 * in. Later sign-ins refresh the Google-managed name/photo without changing
 * the person's chosen URL or privacy preference.
 */
export async function ensureGoogleProfile(identity: GoogleIdentity) {
  const { data: existing, error: readError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", identity.id)
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  if (existing) {
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: identity.name || existing.display_name,
        avatar_url: identity.image || existing.avatar_url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", identity.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("profiles").insert({
      id: identity.id,
      username: usernameFor(identity),
      display_name: identity.name || identity.email.split("@")[0] || "Slate viewer",
      avatar_url: identity.image,
    });
    if (error) throw new Error(error.message);
  }

  await claimLegacyLibrary(identity);
}

/**
 * An existing single-user deployment can nominate one Google email to claim
 * the rows that predate accounts. This runs once and is deliberately opt-in.
 */
async function claimLegacyLibrary(identity: GoogleIdentity) {
  const legacyEmail = process.env.SLATE_LEGACY_OWNER_EMAIL?.trim().toLowerCase();
  if (!legacyEmail || identity.email.trim().toLowerCase() !== legacyEmail) return;

  const { data: alreadyOwned, error } = await supabase
    .from("titles")
    .select("id")
    .eq("owner_id", identity.id)
    .limit(1);
  if (error || (alreadyOwned?.length ?? 0) > 0) return;

  for (const table of ["titles", "lists", "list_titles"]) {
    const { error: claimError } = await supabase
      .from(table)
      .update({ owner_id: identity.id })
      .eq("owner_id", "self-hosted");
    if (claimError) throw new Error(claimError.message);
  }
}

export const getProfileById = cache(async (id: string) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as ProfileRow | null;
});

export const getPublicProfile = cache(async (username: string) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, is_public, created_at, updated_at")
    .eq("username", username.toLowerCase())
    .eq("is_public", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as ProfileRow | null;
});
