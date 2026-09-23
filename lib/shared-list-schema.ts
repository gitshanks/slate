import "server-only";

const SHARED_LIST_SCHEMA_SQL = `
create extension if not exists "pgcrypto";

create table if not exists list_members (
  list_id     uuid not null references lists(id) on delete cascade,
  profile_id text not null references profiles(id) on delete cascade,
  role        text not null default 'editor' check (role = 'editor'),
  invited_by  text references profiles(id) on delete set null,
  joined_at   timestamptz not null default now(),
  primary key (list_id, profile_id)
);

create index if not exists list_members_profile_idx
  on list_members (profile_id, joined_at desc);

create table if not exists list_invites (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references lists(id) on delete cascade,
  token_hash  text unique not null,
  created_by  text not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

create index if not exists list_invites_list_idx on list_invites (list_id);
`;

let schemaPromise: Promise<void> | null = null;

export async function ensureSharedListSchema(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  schemaPromise ??= import("@/lib/neon-client")
    .then(async ({ runNeonQuery }) => {
      await runNeonQuery(SHARED_LIST_SCHEMA_SQL);
    })
    .catch((error) => {
      schemaPromise = null;
      throw error;
    });
  await schemaPromise;
  return true;
}

export async function sharedListSchemaReady(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  const { runNeonQuery } = await import("@/lib/neon-client");
  const rows = await runNeonQuery<{ table_name: string }>(`
    select table_name
    from information_schema.tables
    where table_schema = current_schema()
      and table_name in ('list_members', 'list_invites')
  `);
  return new Set(rows.map((row) => row.table_name)).size === 2;
}
