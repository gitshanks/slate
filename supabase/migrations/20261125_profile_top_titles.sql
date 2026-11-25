-- Top 4: the four titles someone picks to stand for their taste, in order.
-- The first one's backdrop heads their profile. Ids point into titles; ones
-- since removed are skipped when the profile is read. The app never adds this
-- column itself: apply it with `npm run db:migrate:top`, or run this file in
-- the Supabase SQL editor. Until then profiles show no Top 4.
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = current_schema()
      and table_name = 'profiles'
      and column_name = 'top_title_ids'
  ) then
    alter table profiles add column top_title_ids uuid[] not null default '{}';
  end if;
end $$;
