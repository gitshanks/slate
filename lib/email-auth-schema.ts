import "server-only";

const EMAIL_AUTH_SCHEMA_SQL = `
create table if not exists account_emails (
  email_hash  text primary key,
  owner_id    text not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists account_emails_owner_idx on account_emails (owner_id);

create table if not exists email_login_codes (
  email_hash   text primary key,
  code_hash    text not null,
  attempts     integer not null default 0 check (attempts between 0 and 10),
  requested_at timestamptz not null default now(),
  expires_at   timestamptz not null
);

create index if not exists email_login_codes_expiry_idx on email_login_codes (expires_at);

create table if not exists email_auth_rate_limits (
  scope_hash        text primary key,
  request_count     integer not null default 1,
  window_started_at timestamptz not null default now()
);

create index if not exists email_auth_rate_limits_window_idx
  on email_auth_rate_limits (window_started_at);
`;

let schemaPromise: Promise<void> | null = null;

export async function ensureEmailAuthSchema(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  schemaPromise ??= import("@/lib/neon-client")
    .then(async ({ runNeonQuery }) => {
      await runNeonQuery(EMAIL_AUTH_SCHEMA_SQL);
    })
    .catch((error) => {
      schemaPromise = null;
      throw error;
    });
  await schemaPromise;
  return true;
}

export async function emailAuthSchemaReady(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  const { runNeonQuery } = await import("@/lib/neon-client");
  const rows = await runNeonQuery<{ table_name: string }>(`
    select table_name
    from information_schema.tables
    where table_schema = current_schema()
      and table_name in ('account_emails', 'email_login_codes', 'email_auth_rate_limits')
  `);
  return new Set(rows.map((row) => row.table_name)).size === 3;
}
