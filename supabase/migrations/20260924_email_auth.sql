-- Passwordless web authentication. Email addresses and one-time codes are
-- represented by keyed/one-way hashes; no plaintext login email is persisted.

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
