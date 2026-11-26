-- Bio: a line someone writes about themselves, shown under their handle in
-- place of the "Mostly drama and comedy" line Slate writes for them. At most
-- 160 characters. The app never adds this column itself: apply it with
-- `npm run db:migrate:bio`, or run this file in the Supabase SQL editor. Until
-- then Edit profile hides the bio field.
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = current_schema()
      and table_name = 'profiles'
      and column_name = 'bio'
  ) then
    alter table profiles add column bio text
      constraint profiles_bio_length check (bio is null or char_length(bio) <= 160);
  end if;
end $$;
