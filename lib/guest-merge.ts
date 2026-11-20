import type { PoolClient } from "pg";

export interface GuestMergeResult {
  titles: number;
  lists: number;
}

/**
 * Move a guest's slate into a real account, inside the caller's transaction.
 * Nothing the guest saved is lost and nothing the account had is overwritten:
 * - a title only the guest saved moves across as it is;
 * - a title both saved keeps the account's row, taking the guest's rating,
 *   review, favourite and further shelf only where the account had none;
 * - a list moves across, or joins the account's list with the same slug (the
 *   same name), its titles appended in the guest's order;
 * - watched episodes and Previews learning follow, the account's winning.
 * Then the guest account is deleted. Safe to run twice: the second run finds
 * no guest and does nothing.
 */
export async function mergeGuestIntoAccount(
  client: Pick<PoolClient, "query">,
  guestId: string,
  accountId: string,
): Promise<GuestMergeResult | null> {
  if (!guestId.startsWith("guest:") || guestId === accountId) return null;
  // Lock both profiles in a fixed order so two sign-ins cannot interleave.
  const locked = await client.query<{ id: string }>(
    "select id from profiles where id = any($1::text[]) order by id for update",
    [[guestId, accountId]],
  );
  const ids = new Set(locked.rows.map((row) => row.id));
  if (!ids.has(guestId) || !ids.has(accountId)) return null;

  const tables = await client.query<{ table_name: string }>(`
    select table_name from information_schema.tables
    where table_schema = current_schema()
      and table_name in ('watched_episodes', 'preview_feedback')
  `);
  const available = new Set(tables.rows.map((row) => row.table_name));

  const counts = await client.query<{ titles: string; lists: string }>(
    `select (select count(*) from titles where owner_id = $1) as titles,
            (select count(*) from lists where owner_id = $1) as lists`,
    [guestId],
  );

  // Titles both saved: guest row -> account row.
  await client.query(`
    create temporary table guest_title_map on commit drop as
    select g.id as guest_title_id, a.id as account_title_id
    from titles g
    join titles a on a.owner_id = $2 and a.tmdb_id = g.tmdb_id and a.media_type = g.media_type
    where g.owner_id = $1
  `, [guestId, accountId]);
  await client.query(`
    update titles a set
      rating = coalesce(a.rating, g.rating),
      review = coalesce(nullif(a.review, ''), g.review),
      favorite = a.favorite or g.favorite,
      status = case when a.status = 'want' and g.status <> 'want' then g.status else a.status end,
      watched_at = coalesce(a.watched_at, g.watched_at),
      current_season = coalesce(a.current_season, g.current_season),
      current_episode = coalesce(a.current_episode, g.current_episode)
    from guest_title_map m
    join titles g on g.id = m.guest_title_id
    where a.id = m.account_title_id
  `);

  // Lists with the same slug: guest list -> account list.
  await client.query(`
    create temporary table guest_list_map on commit drop as
    select g.id as guest_list_id, a.id as account_list_id
    from lists g
    join lists a on a.owner_id = $2 and a.slug = g.slug
    where g.owner_id = $1
  `, [guestId, accountId]);

  // List entries, re-pointed at the account's rows. Appended after what an
  // account list already holds; a title already in it stays where it is.
  await client.query(`
    insert into list_titles (owner_id, list_id, title_id, position, added_at)
    select $2,
           coalesce(lm.account_list_id, lt.list_id),
           coalesce(tm.account_title_id, lt.title_id),
           lt.position + coalesce((
             select max(x.position) + 1 from list_titles x
             where x.owner_id = $2 and x.list_id = lm.account_list_id
           ), 0),
           lt.added_at
    from list_titles lt
    left join guest_list_map lm on lm.guest_list_id = lt.list_id
    left join guest_title_map tm on tm.guest_title_id = lt.title_id
    where lt.owner_id = $1
    on conflict (owner_id, list_id, title_id) do nothing
  `, [guestId, accountId]);
  await client.query("delete from list_titles where owner_id = $1", [guestId]);

  if (available.has("watched_episodes")) {
    await client.query(`
      insert into watched_episodes (owner_id, title_id, season, episode, watched_at)
      select $2, coalesce(tm.account_title_id, w.title_id), w.season, w.episode, w.watched_at
      from watched_episodes w
      left join guest_title_map tm on tm.guest_title_id = w.title_id
      where w.owner_id = $1
      on conflict do nothing
    `, [guestId, accountId]);
    await client.query("delete from watched_episodes where owner_id = $1", [guestId]);
  }

  // Duplicates go; everything else changes hands.
  await client.query(
    "delete from titles where id in (select guest_title_id from guest_title_map)",
  );
  await client.query("update titles set owner_id = $2 where owner_id = $1", [guestId, accountId]);
  await client.query(
    "delete from lists where id in (select guest_list_id from guest_list_map)",
  );
  await client.query("update lists set owner_id = $2 where owner_id = $1", [guestId, accountId]);

  if (available.has("preview_feedback")) {
    await client.query(`
      update preview_feedback set owner_id = $2
      where owner_id = $1
        and not exists (select 1 from preview_feedback where owner_id = $2)
    `, [guestId, accountId]);
    await client.query("delete from preview_feedback where owner_id = $1", [guestId]);
  }

  // Someone who already built a slate as a guest has done onboarding.
  const moved = Number(counts.rows[0]?.titles ?? 0);
  if (moved > 0) {
    await client.query(
      "update profiles set onboarding_completed_at = coalesce(onboarding_completed_at, now()) where id = $1",
      [accountId],
    );
  }
  await client.query("delete from profiles where id = $1", [guestId]);

  return { titles: moved, lists: Number(counts.rows[0]?.lists ?? 0) };
}

/**
 * Delete guest accounts nobody has opened in `idleDays`. A guest's
 * `updated_at` is touched at most once a day while they use Slate.
 */
export async function pruneIdleGuests(
  client: Pick<PoolClient, "query">,
  idleDays = 60,
  limit = 50,
): Promise<number> {
  const idle = await client.query<{ id: string }>(
    `select id from profiles
     where id like 'guest:%' and updated_at < now() - make_interval(days => $1)
     order by updated_at
     limit $2`,
    [idleDays, limit],
  );
  const ids = idle.rows.map((row) => row.id);
  if (!ids.length) return 0;
  await client.query("delete from list_titles where owner_id = any($1::text[])", [ids]);
  await client.query("delete from lists where owner_id = any($1::text[])", [ids]);
  await client.query("delete from titles where owner_id = any($1::text[])", [ids]);
  const feedback = await client.query(`
    select 1 from information_schema.tables
    where table_schema = current_schema() and table_name = 'preview_feedback'
  `);
  if (feedback.rows.length) {
    await client.query("delete from preview_feedback where owner_id = any($1::text[])", [ids]);
  }
  await client.query("delete from profiles where id = any($1::text[])", [ids]);
  return ids.length;
}
