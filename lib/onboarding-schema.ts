import "server-only";

import { runNeonQuery } from "@/lib/neon-client";

let schemaPromise: Promise<boolean> | null = null;

/**
 * Add the onboarding marker before profile creation. Running the existing-row
 * backfill first means accounts already using slate are not interrupted, while
 * a profile inserted afterward keeps the null marker and enters onboarding.
 */
export function ensureOnboardingSchema() {
  if (!process.env.DATABASE_URL) return Promise.resolve(false);
  if (!schemaPromise) {
    schemaPromise = runNeonQuery(`
      do $$
      begin
        if not exists (
          select 1
          from information_schema.columns
          where table_schema = current_schema()
            and table_name = 'profiles'
            and column_name = 'onboarding_completed_at'
        ) then
          alter table profiles add column onboarding_completed_at timestamptz;
          update profiles
          set onboarding_completed_at = coalesce(updated_at, created_at, now())
          where onboarding_completed_at is null;
        end if;
      end $$;
    `)
      .then(() => true)
      .catch((error) => {
        schemaPromise = null;
        throw error;
      });
  }
  return schemaPromise;
}
