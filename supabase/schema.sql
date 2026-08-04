-- Run this once in the Supabase SQL editor (or psql) to create the schema.
-- Hosted mode scopes every library query by owner_id in the server-side DAL.
-- Self-hosted mode uses the stable "self-hosted" owner. The database
-- credential is only used in server-only modules.

create extension if not exists "pgcrypto";

create table if not exists titles (
  id             uuid primary key default gen_random_uuid(),
  owner_id       text not null default 'self-hosted',
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
  position       integer not null default 0,
  tmdb_rating       numeric(3,1),
  tmdb_vote_count   integer,
  imdb_id           text,
  omdb_plot         text,
  omdb_plot_fetched_at timestamptz,
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
  unique (owner_id, tmdb_id, media_type)
);

-- Idempotent column adds for existing deployments.
alter table titles add column if not exists tmdb_rating       numeric(3,1);
alter table titles add column if not exists tmdb_vote_count   integer;
alter table titles add column if not exists imdb_id           text;
alter table titles add column if not exists omdb_plot         text;
alter table titles add column if not exists omdb_plot_fetched_at timestamptz;
alter table titles add column if not exists imdb_rating       numeric(3,1);
alter table titles add column if not exists imdb_votes        integer;
alter table titles add column if not exists rt_score          integer;
alter table titles add column if not exists metacritic_score  integer;
alter table titles add column if not exists ratings_fetched_at timestamptz;
alter table titles add column if not exists current_season  integer;
alter table titles add column if not exists current_episode integer;
alter table titles add column if not exists seasons         jsonb;
alter table titles add column if not exists position        integer;
alter table titles add column if not exists owner_id       text;
update titles set owner_id = 'self-hosted' where owner_id is null;
alter table titles alter column owner_id set default 'self-hosted';
alter table titles alter column owner_id set not null;

-- Preserve the pre-reordering default (most recent first) the first time the
-- position column is introduced. Existing custom positions are never touched.
with ranked_titles as (
  select
    id,
    row_number() over (
      partition by status
      order by
        case when status = 'watched' then watched_at else added_at end desc nulls last,
        added_at desc
    ) - 1 as position
  from titles
)
update titles
set position = ranked_titles.position
from ranked_titles
where titles.id = ranked_titles.id
  and titles.position is null;

alter table titles alter column position set default 0;
update titles set position = 0 where position is null;
alter table titles alter column position set not null;

-- Older single-user schemas used a global TMDB uniqueness constraint. Hosted
-- accounts need the same title to exist once per owner.
alter table titles drop constraint if exists titles_tmdb_id_media_type_key;

drop index if exists titles_status_idx;
drop index if exists titles_status_position_idx;
create index if not exists titles_status_idx     on titles (owner_id, status);
create index if not exists titles_added_at_idx   on titles (added_at desc);
create index if not exists titles_watched_at_idx on titles (watched_at desc);
create index if not exists titles_status_position_idx on titles (owner_id, status, position);
create unique index if not exists titles_owner_tmdb_type_idx
  on titles (owner_id, tmdb_id, media_type);

create table if not exists lists (
  id          uuid primary key default gen_random_uuid(),
  owner_id    text not null default 'self-hosted',
  slug        text not null,
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  unique (owner_id, slug)
);

alter table lists add column if not exists owner_id text;
update lists set owner_id = 'self-hosted' where owner_id is null;
alter table lists alter column owner_id set default 'self-hosted';
alter table lists alter column owner_id set not null;
alter table lists drop constraint if exists lists_slug_key;
create unique index if not exists lists_owner_slug_idx
  on lists (owner_id, slug);

create table if not exists list_titles (
  owner_id  text not null default 'self-hosted',
  list_id   uuid not null references lists(id) on delete cascade,
  title_id  uuid not null references titles(id) on delete cascade,
  position  integer not null default 0,
  added_at  timestamptz not null default now(),
  primary key (owner_id, list_id, title_id)
);

alter table list_titles add column if not exists owner_id text;
update list_titles set owner_id = 'self-hosted' where owner_id is null;
alter table list_titles alter column owner_id set default 'self-hosted';
alter table list_titles alter column owner_id set not null;
alter table list_titles drop constraint if exists list_titles_pkey;
alter table list_titles
  add constraint list_titles_pkey primary key (owner_id, list_id, title_id);

drop index if exists list_titles_list_idx;
create index if not exists list_titles_list_idx on list_titles (owner_id, list_id, position);

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

create index if not exists profiles_public_username_idx
  on profiles (username) where is_public;
