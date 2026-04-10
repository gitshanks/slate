-- Run this once in the Supabase SQL editor (or psql) to create the schema.
-- Single-user app: RLS stays disabled and access is gated by Next.js proxy
-- middleware. Service-role key is only used server-side.

create extension if not exists "pgcrypto";

create table if not exists titles (
  id             uuid primary key default gen_random_uuid(),
  tmdb_id        integer not null,
  media_type     text not null check (media_type in ('movie', 'tv')),
  title          text not null,
  original_title text,
  overview       text,
  poster_path    text,
  backdrop_path  text,
  release_date   date,
  runtime        integer,
  genres         jsonb,
  status         text not null default 'want'
                  check (status in ('want', 'watching', 'watched', 'dropped')),
  rating         numeric(2,1),
  review         text,
  favorite       boolean not null default false,
  added_at       timestamptz not null default now(),
  watched_at     timestamptz,
  unique (tmdb_id, media_type)
);

create index if not exists titles_status_idx     on titles (status);
create index if not exists titles_added_at_idx   on titles (added_at desc);
create index if not exists titles_watched_at_idx on titles (watched_at desc);

create table if not exists lists (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);

create table if not exists list_titles (
  list_id   uuid not null references lists(id) on delete cascade,
  title_id  uuid not null references titles(id) on delete cascade,
  position  integer not null default 0,
  added_at  timestamptz not null default now(),
  primary key (list_id, title_id)
);

create index if not exists list_titles_list_idx on list_titles (list_id, position);
