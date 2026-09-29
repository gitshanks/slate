do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = current_schema()
      and table_name = 'profiles'
      and column_name = 'onboarding_completed_at'
  ) then
    alter table profiles add column onboarding_completed_at timestamptz;

    -- Accounts that existed before onboarding shipped should keep going
    -- straight to their library. Profiles created after this migration remain
    -- null until the person completes the first-account flow.
    update profiles
    set onboarding_completed_at = coalesce(updated_at, created_at, now())
    where onboarding_completed_at is null;
  end if;
end $$;
