-- Add hosted Google accounts and per-user library ownership while preserving
-- every existing single-user row under the stable "self-hosted" owner.

create table if not exists profiles (
  id            text primary key,
  username      text unique not null
                  check (username ~ '^[a-z0-9][a-z0-9-]{2,29}$'),
  display_name  text not null,
  avatar_url    text,
  avatar_data   bytea,
  avatar_mime   text
                  check (avatar_mime in ('image/jpeg', 'image/png', 'image/webp')),
  avatar_updated_at timestamptz,
  identity_customized boolean not null default false,
  is_public     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Existing hosted installs already have the profiles table. Keep this
-- migration rerunnable so deploying the profile editor is a safe additive
-- schema change rather than a coordinated cutover.
alter table profiles add column if not exists avatar_data bytea;
alter table profiles add column if not exists avatar_mime text;
alter table profiles add column if not exists avatar_updated_at timestamptz;
alter table profiles
  add column if not exists identity_customized boolean not null default false;
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_avatar_mime_check'
      and conrelid = 'profiles'::regclass
  ) then
    alter table profiles
      add constraint profiles_avatar_mime_check
      check (avatar_mime in ('image/jpeg', 'image/png', 'image/webp'));
  end if;
end
$$;

create index if not exists profiles_public_username_idx
  on profiles (username) where is_public;

alter table titles add column if not exists owner_id text;
alter table lists add column if not exists owner_id text;
alter table list_titles add column if not exists owner_id text;

update titles set owner_id = 'self-hosted' where owner_id is null;
update lists set owner_id = 'self-hosted' where owner_id is null;
update list_titles set owner_id = 'self-hosted' where owner_id is null;

alter table titles alter column owner_id set default 'self-hosted';
alter table lists alter column owner_id set default 'self-hosted';
alter table list_titles alter column owner_id set default 'self-hosted';
alter table titles alter column owner_id set not null;
alter table lists alter column owner_id set not null;
alter table list_titles alter column owner_id set not null;

-- Replace the old global uniqueness constraints with per-account variants.
alter table titles drop constraint if exists titles_tmdb_id_media_type_key;
alter table lists drop constraint if exists lists_slug_key;
alter table list_titles drop constraint if exists list_titles_pkey;

create unique index if not exists titles_owner_tmdb_type_idx
  on titles (owner_id, tmdb_id, media_type);
create unique index if not exists lists_owner_slug_idx
  on lists (owner_id, slug);
alter table list_titles
  add constraint list_titles_pkey primary key (owner_id, list_id, title_id);

drop index if exists titles_status_idx;
drop index if exists titles_status_position_idx;
drop index if exists list_titles_list_idx;

create index if not exists titles_status_idx
  on titles (owner_id, status);
create index if not exists titles_status_position_idx
  on titles (owner_id, status, position);
create index if not exists list_titles_list_idx
  on list_titles (owner_id, list_id, position);
