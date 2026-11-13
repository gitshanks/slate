import "server-only";

import { cookies } from "next/headers";
import { runNeonQuery } from "@/lib/neon-client";
import { SIGNUP_SOURCE_COOKIE, decodeSignupSource } from "@/lib/signup-source";

let schemaPromise: Promise<boolean> | null = null;

export function ensureSignupSourceSchema() {
  if (!process.env.DATABASE_URL) return Promise.resolve(false);
  if (!schemaPromise) {
    schemaPromise = runNeonQuery(`
      create table if not exists signup_sources (
        owner_id      text primary key references profiles(id) on delete cascade,
        source        text not null,
        medium        text,
        campaign      text,
        referrer_host text,
        in_app        text,
        landing_path  text,
        first_seen_at timestamptz,
        recorded_at   timestamptz not null default now()
      )
    `)
      .then(() => true)
      .catch((error) => {
        schemaPromise = null;
        throw error;
      });
  }
  return schemaPromise;
}

/**
 * Save the first-touch source for an account created in the last half hour.
 * Older accounts signing in again are never attributed, so a returning user
 * who later taps an Instagram link is not counted as an Instagram signup.
 */
export async function recordSignupSource(ownerId: string) {
  if (!process.env.DATABASE_URL) return;
  const cookieStore = await cookies();
  const source = decodeSignupSource(cookieStore.get(SIGNUP_SOURCE_COOKIE)?.value);
  if (!source) return;
  await ensureSignupSourceSchema();
  await runNeonQuery(
    `insert into signup_sources
       (owner_id, source, medium, campaign, referrer_host, in_app, landing_path, first_seen_at)
     select id, $2, $3, $4, $5, $6, $7, $8
     from profiles
     where id = $1 and created_at > now() - interval '30 minutes'
     on conflict (owner_id) do nothing`,
    [
      ownerId,
      source.source,
      source.medium,
      source.campaign,
      source.referrerHost,
      source.inApp,
      source.landingPath,
      source.firstSeenAt,
    ],
  );
}
