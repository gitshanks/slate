-- Private collaborative lists. Owners remain the only people allowed to
-- rename/delete a list or manage access; members can edit its title queue.

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
