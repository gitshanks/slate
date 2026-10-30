-- A short grace window for rotated refresh tokens. A client can lose the
-- rotated token (killed after the server rotated, before it saved the reply);
-- presenting the previous token within the window issues a fresh one instead
-- of logging the device out. Additive: older code ignores these columns.
alter table device_sessions add column if not exists previous_refresh_token_hash text;
alter table device_sessions add column if not exists rotated_at timestamptz;

create index if not exists device_sessions_previous_hash_idx
  on device_sessions (previous_refresh_token_hash)
  where previous_refresh_token_hash is not null;
