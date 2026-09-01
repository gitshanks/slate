-- One compact, owner-scoped snapshot for preview-feed learning. The browser
-- batches signals in memory; this table never receives a row per swipe or per
-- session. There is intentionally no profiles FK because self-hosted installs
-- use the stable `self-hosted` owner without requiring an account row.

create table if not exists preview_feedback (
  owner_id          text primary key default 'self-hosted',
  revision          bigint not null default 0,
  source_weights    jsonb not null default '{}'::jsonb,
  genre_weights     jsonb not null default '{}'::jsonb,
  media_type_weights jsonb not null default '{}'::jsonb,
  recent_exposures  jsonb not null default '[]'::jsonb,
  totals            jsonb not null default '{}'::jsonb,
  recent_batch_ids  jsonb not null default '[]'::jsonb,
  last_session_id   text,
  last_started_at   timestamptz,
  updated_at        timestamptz not null default now()
);

-- Keep the migration safe to rerun after an interrupted/partial deployment.
alter table preview_feedback add column if not exists revision bigint not null default 0;
alter table preview_feedback add column if not exists source_weights jsonb not null default '{}'::jsonb;
alter table preview_feedback add column if not exists genre_weights jsonb not null default '{}'::jsonb;
alter table preview_feedback add column if not exists media_type_weights jsonb not null default '{}'::jsonb;
alter table preview_feedback add column if not exists recent_exposures jsonb not null default '[]'::jsonb;
alter table preview_feedback add column if not exists totals jsonb not null default '{}'::jsonb;
alter table preview_feedback add column if not exists recent_batch_ids jsonb not null default '[]'::jsonb;
alter table preview_feedback add column if not exists last_session_id text;
alter table preview_feedback add column if not exists last_started_at timestamptz;
alter table preview_feedback add column if not exists updated_at timestamptz not null default now();

comment on table preview_feedback is
  'Bounded per-owner EMA and cooldown snapshot; updated with session aggregates only.';
