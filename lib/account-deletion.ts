import type { PoolClient } from "pg";

/**
 * The caller owns the transaction and derives ownerId from the session.
 * Every explicit predicate is scoped to that owner. FK cascades remove the
 * account's memberships, invites, email mappings, identities, and devices.
 */
export async function deleteAccountData(
  client: Pick<PoolClient, "query">,
  ownerId: string,
  emailHash: string | null,
) {
  const profile = await client.query("select id from profiles where id = $1 for update", [ownerId]);
  if (!profile.rows.length) throw new Error("Account no longer exists");

  // Optional features may not have created their tables on older installs.
  const tables = await client.query<{ table_name: string }>(`
    select table_name from information_schema.tables
    where table_schema = current_schema()
      and table_name in ('account_emails', 'email_login_codes', 'preview_feedback')
  `);
  const available = new Set(tables.rows.map((row) => row.table_name));
  if (available.has("email_login_codes")) {
    if (available.has("account_emails")) {
      await client.query(`
        delete from email_login_codes
        where email_hash = $2 or email_hash in (
          select email_hash from account_emails where owner_id = $1
        )
      `, [ownerId, emailHash]);
    } else if (emailHash) {
      await client.query("delete from email_login_codes where email_hash = $1", [emailHash]);
    }
  }
  await client.query("delete from list_titles where owner_id = $1", [ownerId]);
  await client.query("delete from lists where owner_id = $1", [ownerId]);
  await client.query("delete from titles where owner_id = $1", [ownerId]);
  if (available.has("preview_feedback")) {
    await client.query("delete from preview_feedback where owner_id = $1", [ownerId]);
  }
  await client.query("delete from profiles where id = $1", [ownerId]);
}
