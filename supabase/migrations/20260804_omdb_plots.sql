-- Cache full OMDb plots without overwriting the existing TMDB overview.
-- Re-running is safe.

alter table titles add column if not exists omdb_plot text;
alter table titles add column if not exists omdb_plot_fetched_at timestamptz;
