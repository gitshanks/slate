-- First-touch signup attribution: where an account's first visit came from
-- (UTM tags, referring site host, in-app browser). One row per account, written
-- once at sign-up. The app also creates this table on first use.
create table if not exists signup_sources (
  owner_id      text primary key references profiles(id) on delete cascade,
  source        text not null,
  medium        text,
  campaign      text,
  referrer_host text,
  in_app        text,
  landing_path  text,
  first_seen_at timestamptz,
  recorded_at   timestamptz not null default now()
);
