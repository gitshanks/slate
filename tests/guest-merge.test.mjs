import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";

function load(file) {
  const output = ts.transpileModule(fs.readFileSync(new URL("../" + file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, Date, Number, URLSearchParams, require() { throw new Error("no deps"); } });
  return exports;
}

const { mergeGuestIntoAccount, pruneIdleGuests } = load("lib/guest-merge.ts");
const { isGuestOwnerId, guestSignupPath, guestIsReturning } = load("lib/guest-id.ts");

const schema = fs.readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8")
  .replace('create extension if not exists "pgcrypto";', "");

const G = "guest:11111111-1111-4111-8111-111111111111";
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const seed = `
insert into profiles (id, username, display_name) values
  ('acct', 'acct-user', 'Account'), ('${G}', 'guest-abc', 'Guest'), ('other', 'other-user', 'Other');
-- The account already has film 1 (Up Next, no rating) and a list "faves".
insert into titles (id, owner_id, tmdb_id, media_type, title, status) values
  ('${id(1)}', 'acct', 1, 'movie', 'Shared film', 'want'),
  ('${id(2)}', 'acct', 2, 'movie', 'Account only', 'watched');
insert into lists (id, owner_id, slug, name) values ('${id(10)}', 'acct', 'faves', 'Faves');
insert into list_titles (owner_id, list_id, title_id, position) values ('acct', '${id(10)}', '${id(2)}', 0);
-- The guest saved film 1 (watched, rated) and show 3, a list "faves" and a list "bourdain".
insert into titles (id, owner_id, tmdb_id, media_type, title, status, rating, favorite) values
  ('${id(3)}', '${G}', 1, 'movie', 'Shared film', 'watched', 4.5, true),
  ('${id(4)}', '${G}', 3, 'tv', 'Guest show', 'watching', null, false);
insert into lists (id, owner_id, slug, name) values
  ('${id(11)}', '${G}', 'faves', 'Faves'),
  ('${id(12)}', '${G}', 'bourdain', 'Bourdain');
insert into list_titles (owner_id, list_id, title_id, position) values
  ('${G}', '${id(11)}', '${id(3)}', 0),
  ('${G}', '${id(11)}', '${id(4)}', 1),
  ('${G}', '${id(12)}', '${id(3)}', 0);
insert into watched_episodes (owner_id, title_id, season, episode) values ('${G}', '${id(4)}', 1, 1);
insert into preview_feedback (owner_id, revision) values ('${G}', 7);
-- Someone else's data is never touched.
insert into titles (id, owner_id, tmdb_id, media_type, title) values ('${id(5)}', 'other', 1, 'movie', 'Shared film');
`;

test("guest ids and sign-up paths", () => {
  assert.equal(isGuestOwnerId(G), true);
  assert.equal(isGuestOwnerId("google:123"), false);
  assert.equal(isGuestOwnerId(undefined), false);
  assert.equal(guestSignupPath("/lists/abc"), "/login?mode=create&next=%2Flists%2Fabc");
  assert.equal(guestSignupPath("/app"), "/login?mode=create");
  assert.equal(guestSignupPath("//evil.example"), "/login?mode=create");
  const now = Date.parse("2026-11-20T12:00:00Z");
  assert.equal(guestIsReturning("2026-11-20T06:00:00Z", now), false);
  assert.equal(guestIsReturning("2026-11-19T20:00:00Z", now), true);
});

test("a guest's slate moves into an account without losing or overwriting anything", async () => {
  const db = new PGlite();
  try {
    await db.exec(schema);
    await db.exec(seed);
    const result = await db.transaction((tx) => mergeGuestIntoAccount(tx, G, "acct"));
    assert.deepEqual({ ...result }, { titles: 2, lists: 2 });

    const titles = (await db.query("select id, tmdb_id, status, rating::float as rating, favorite from titles where owner_id = 'acct' order by tmdb_id")).rows;
    assert.equal(titles.length, 3, "film 1 is not duplicated");
    // The account's row for film 1 is kept and takes the guest's progress.
    assert.equal(titles[0].id, id(1));
    assert.equal(titles[0].status, "watched");
    assert.equal(titles[0].rating, 4.5);
    assert.equal(titles[0].favorite, true);
    assert.equal(titles[1].status, "watched", "the account's own title is unchanged");
    assert.equal(titles[2].id, id(4), "a guest-only title moves across as it is");

    const lists = (await db.query("select id, slug from lists where owner_id = 'acct' order by slug")).rows;
    assert.deepEqual(lists.map((row) => row.slug), ["bourdain", "faves"]);
    const faves = (await db.query(`select title_id, position from list_titles where list_id = '${id(10)}' order by position`)).rows;
    assert.deepEqual(faves.map((row) => row.title_id), [id(2), id(1), id(4)], "guest entries are appended, re-pointed at the account's rows");
    const bourdain = (await db.query(`select owner_id, title_id from list_titles where list_id = '${id(12)}'`)).rows;
    assert.deepEqual(bourdain, [{ owner_id: "acct", title_id: id(1) }]);

    assert.deepEqual((await db.query("select owner_id, title_id from watched_episodes")).rows, [{ owner_id: "acct", title_id: id(4) }]);
    assert.equal((await db.query("select revision::int as r from preview_feedback where owner_id = 'acct'")).rows[0].r, 7);
    assert.ok((await db.query("select onboarding_completed_at from profiles where id = 'acct'")).rows[0].onboarding_completed_at);

    for (const table of ["titles", "lists", "list_titles", "watched_episodes", "preview_feedback"]) {
      assert.equal((await db.query(`select * from ${table} where owner_id = '${G}'`)).rows.length, 0, table);
    }
    assert.equal((await db.query(`select * from profiles where id = '${G}'`)).rows.length, 0, "the guest is gone");
    assert.equal((await db.query("select * from titles where owner_id = 'other'")).rows.length, 1);

    // A second run (a retried sign-in) finds no guest and changes nothing.
    assert.equal(await db.transaction((tx) => mergeGuestIntoAccount(tx, G, "acct")), null);
  } finally {
    await db.close();
  }
});

test("only a guest can be merged, and never into itself", async () => {
  const db = new PGlite();
  try {
    await db.exec(schema);
    await db.exec(seed);
    assert.equal(await db.transaction((tx) => mergeGuestIntoAccount(tx, "other", "acct")), null);
    assert.equal(await db.transaction((tx) => mergeGuestIntoAccount(tx, G, G)), null);
    assert.equal(await db.transaction((tx) => mergeGuestIntoAccount(tx, G, "missing")), null);
    assert.equal((await db.query("select * from titles where owner_id = 'other'")).rows.length, 1);
    assert.equal((await db.query(`select * from titles where owner_id = '${G}'`)).rows.length, 2);
  } finally {
    await db.close();
  }
});

test("idle guests are pruned with their data; active guests and accounts stay", async () => {
  const db = new PGlite();
  try {
    await db.exec(schema);
    await db.exec(seed);
    await db.exec(`
      insert into profiles (id, username, display_name) values ('guest:active', 'guest-active', 'Guest');
      update profiles set updated_at = now() - interval '90 days' where id in ('${G}', 'other');
    `);
    assert.equal(await db.transaction((tx) => pruneIdleGuests(tx, 60)), 1);
    const left = (await db.query("select id from profiles order by id")).rows.map((row) => row.id);
    assert.deepEqual(left, ["acct", "guest:active", "other"]);
    assert.equal((await db.query(`select * from titles where owner_id = '${G}'`)).rows.length, 0);
    assert.equal((await db.query("select * from watched_episodes")).rows.length, 0);
  } finally {
    await db.close();
  }
});
