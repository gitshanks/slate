-- Native iOS / Android authentication and the timestamps needed by mobile
-- sync. This is additive: existing Auth.js sessions and owner IDs keep working.

create extension if not exists "pgcrypto";

create table if not exists auth_identities (
  provider          text not null check (provider in ('google', 'apple')),
  provider_subject  text not null,
  owner_id           text not null references profiles(id) on delete cascade,
  email              text,
  email_verified     boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  primary key (provider, provider_subject)
);

create index if not exists auth_identities_owner_idx
  on auth_identities (owner_id);

create table if not exists device_sessions (
  id                  uuid primary key default gen_random_uuid(),
  owner_id             text not null references profiles(id) on delete cascade,
  refresh_token_hash   text unique not null,
  platform             text not null check (platform in ('ios', 'android')),
  device_name          text,
  created_at           timestamptz not null default now(),
  last_used_at         timestamptz not null default now(),
  expires_at           timestamptz not null,
  revoked_at           timestamptz
);

create index if not exists device_sessions_owner_idx
  on device_sessions (owner_id, revoked_at);
create index if not exists device_sessions_expiry_idx
  on device_sessions (expires_at);

alter table titles add column if not exists updated_at timestamptz not null default now();
alter table lists add column if not exists updated_at timestamptz not null default now();
alter table list_titles add column if not exists updated_at timestamptz not null default now();

create or replace function slate_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists titles_touch_updated_at on titles;
create trigger titles_touch_updated_at
before update on titles
for each row execute function slate_touch_updated_at();

drop trigger if exists lists_touch_updated_at on lists;
create trigger lists_touch_updated_at
before update on lists
for each row execute function slate_touch_updated_at();

drop trigger if exists list_titles_touch_updated_at on list_titles;
create trigger list_titles_touch_updated_at
before update on list_titles
for each row execute function slate_touch_updated_at();
