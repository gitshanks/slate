begin;

alter table titles add column if not exists position integer;

-- Match the app's previous default ordering the first time this migration runs.
-- Re-running it leaves every already-populated custom position untouched.
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

create index if not exists titles_status_position_idx
  on titles (status, position);

commit;
