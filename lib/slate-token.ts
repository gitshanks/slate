import { supabase } from "@/lib/supabase";

/**
 * Token used by the Slate browser extension to authenticate when POSTing
 * scraped history rows to `/api/import/submit`. Single-user app, so there's
 * exactly one token globally — stored as a row in `app_settings` keyed
 * `"import_token"`. The token is a UUID v4 generated lazily on first read.
 *
 * Requires the `app_settings` table from `supabase/schema.sql`. If the table
 * is missing (user hasn't applied the migration yet), every helper here will
 * return `null` so callers can surface a setup message rather than crash.
 */

const TOKEN_KEY = "import_token";

type SettingsRow = { value: string };

async function readSetting(key: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error) return null;
    return (data as SettingsRow | null)?.value ?? null;
  } catch {
    return null;
  }
}

async function writeSetting(key: string, value: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Returns the current import token, creating one if missing. Returns `null`
 * only if the `app_settings` table isn't reachable — callers should show a
 * "run the migration" hint in that case.
 */
export async function getOrCreateImportToken(): Promise<string | null> {
  const existing = await readSetting(TOKEN_KEY);
  if (existing) return existing;
  const fresh = crypto.randomUUID();
  const ok = await writeSetting(TOKEN_KEY, fresh);
  return ok ? fresh : null;
}

/**
 * Generates a new token and overwrites the existing one. Used by the
 * "Regenerate" button on `/settings`. Any previously-paired extension
 * instance gets 401s until the user re-pastes.
 */
export async function rotateImportToken(): Promise<string | null> {
  const fresh = crypto.randomUUID();
  const ok = await writeSetting(TOKEN_KEY, fresh);
  return ok ? fresh : null;
}

/**
 * Constant-time comparison to verify a bearer token. Returns false if the
 * table is unreachable or the value doesn't match.
 */
export async function verifyImportToken(candidate: string): Promise<boolean> {
  if (!candidate || typeof candidate !== "string") return false;
  const stored = await readSetting(TOKEN_KEY);
  if (!stored) return false;
  if (stored.length !== candidate.length) return false;
  let diff = 0;
  for (let i = 0; i < stored.length; i++) {
    diff |= stored.charCodeAt(i) ^ candidate.charCodeAt(i);
  }
  return diff === 0;
}
