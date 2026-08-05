import "server-only";

import { ensureGoogleProfile, type ProfileRow } from "@/lib/profiles";
import { supabase } from "@/lib/supabase";
import { slugify } from "@/lib/utils";
import type { VerifiedProviderIdentity } from "@/lib/native-api/provider-identity";

interface IdentityRow {
  provider: "google" | "apple";
  provider_subject: string;
  owner_id: string;
  email: string | null;
  email_verified: boolean;
}

function ownerIdFor(identity: VerifiedProviderIdentity): string {
  return `${identity.provider}:${identity.subject}`;
}

function usernameFor(identity: VerifiedProviderIdentity): string {
  const emailStem = identity.email?.split("@")[0] ?? "";
  const base =
    (slugify(emailStem) || slugify(identity.name ?? "") || "viewer")
      .replace(/_/g, "-")
      .replace(/^-+|-+$/g, "") || "viewer";
  const suffix = identity.subject.replace(/[^a-z0-9]/gi, "").slice(-10).toLowerCase();
  return `${base.slice(0, 19)}-${suffix || "slate"}`;
}

async function ensureProfile(ownerId: string, identity: VerifiedProviderIdentity) {
  const { data: existing, error: readError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", ownerId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  if (existing) {
    const profile = existing as ProfileRow;
    if (!profile.identity_customized) {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: identity.name || profile.display_name,
          avatar_url: identity.avatarUrl || profile.avatar_url,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ownerId);
      if (error) throw new Error(error.message);
    }
    return;
  }

  const displayName =
    identity.name || identity.email?.split("@")[0] || "slate viewer";
  const { error } = await supabase.from("profiles").insert({
    id: ownerId,
    username: usernameFor(identity),
    display_name: displayName,
    avatar_url: identity.avatarUrl,
  });
  if (error && !error.message.toLowerCase().includes("duplicate")) {
    throw new Error(error.message);
  }
}

/** Resolve a verified provider identity to Slate's durable library owner. */
export async function resolveNativeOwner(
  identity: VerifiedProviderIdentity,
): Promise<string> {
  const { data: current, error: readError } = await supabase
    .from("auth_identities")
    .select("provider, provider_subject, owner_id, email, email_verified")
    .eq("provider", identity.provider)
    .eq("provider_subject", identity.subject)
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  const existing = current as IdentityRow | null;
  const ownerId = existing?.owner_id ?? ownerIdFor(identity);

  // Preserve the one-time legacy-library claim used by hosted Google accounts.
  if (identity.provider === "google" && ownerId === ownerIdFor(identity)) {
    await ensureGoogleProfile({
      id: ownerId,
      email: identity.email!,
      name: identity.name,
      image: identity.avatarUrl,
    });
  } else {
    await ensureProfile(ownerId, identity);
  }

  const now = new Date().toISOString();
  const { error: identityError } = await supabase.from("auth_identities").upsert(
    {
      provider: identity.provider,
      provider_subject: identity.subject,
      owner_id: ownerId,
      email: identity.email ?? existing?.email ?? null,
      email_verified: identity.emailVerified || existing?.email_verified || false,
      updated_at: now,
    },
    { onConflict: "provider,provider_subject" },
  );
  if (identityError) throw new Error(identityError.message);

  return ownerId;
}
