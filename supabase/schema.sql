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
  tmdb_rating       numeric(3,1),
  tmdb_vote_count   integer,
  imdb_id           text,
  imdb_rating       numeric(3,1),
  imdb_votes        integer,
  rt_score          integer,
  metacritic_score  integer,
  ratings_fetched_at timestamptz,
  -- Episode-position tracking for TV shows (null on movies and TV the user
  -- hasn't started yet). seasons mirrors TMDB's per-season episode counts so
  -- the +1 button can roll over to the next season without a TMDB round-trip.
  current_season  integer,
  current_episode integer,
  seasons         jsonb,
  unique (tmdb_id, media_type)
);

-- Idempotent column adds for existing deployments.
alter table titles add column if not exists tmdb_rating       numeric(3,1);
alter table titles add column if not exists tmdb_vote_count   integer;
alter table titles add column if not exists imdb_id           text;
alter table titles add column if not exists imdb_rating       numeric(3,1);
alter table titles add column if not exists imdb_votes        integer;
alter table titles add column if not exists rt_score          integer;
alter table titles add column if not exists metacritic_score  integer;
alter table titles add column if not exists ratings_fetched_at timestamptz;
alter table titles add column if not exists current_season  integer;
alter table titles add column if not exists current_episode integer;
alter table titles add column if not exists seasons         jsonb;

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
