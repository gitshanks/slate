-- Per-episode watched state for TV tracking. One row per watched episode;
-- unwatched is the absence of a row. Cascades on delete with the title.
-- There is intentionally no profiles FK because self-hosted installs use the
-- stable `self-hosted` owner without requiring an account row.

create table if not exists watched_episodes (
  owner_id   text not null default 'self-hosted',
  title_id   uuid not null references titles (id) on delete cascade,
  season     integer not null check (season >= 0),
  episode    integer not null check (episode >= 1),
  watched_at timestamptz not null default now(),
  primary key (owner_id, title_id, season, episode)
);

create index if not exists watched_episodes_title_idx
  on watched_episodes (owner_id, title_id);

comment on table watched_episodes is
  'Per-episode watched markers for TV shows; absence of a row means unwatched.';
