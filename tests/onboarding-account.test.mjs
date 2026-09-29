import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import * as crypto from "node:crypto";
import * as jose from "jose";

function load(file, dependencies = {}) {
  const output = ts.transpileModule(fs.readFileSync(new URL("../" + file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, {
    exports, Date, Set, FormData, TextEncoder, Response,
    process: { env: { DATABASE_URL: "test-only", AUTH_SECRET: "isolated-test-secret-at-least-32-characters" } },
    require(name) {
      if (name in dependencies) return dependencies[name];
      throw new Error("Unexpected dependency: " + name);
    },
  });
  return exports;
}

const recommendationHelpers = load("lib/onboarding-recommendations.ts");
const { selectStarterRecommendations, parseOnboardingPicks, MAX_ONBOARDING_SELECTIONS } = recommendationHelpers;
const { belongsToAccount } = load("lib/account-session.ts");
const { deleteAccountData } = load("lib/account-deletion.ts");

function item(id, media_type = "movie") {
  return { id, media_type, title: "Title " + id, poster_path: "/p.jpg", backdrop_path: "/b.jpg", overview: "A real synopsis." };
}
const pick = (tmdbId, mediaType = "movie") => ({ tmdbId, mediaType });

test("starter suggestions exclude passed/kept titles, dedupe across sources, and balance seeds", () => {
  const result = selectStarterRecommendations([
    [item(1), item(3), item(4), item(5), item(6), item(7), item(8)],
    [item(2, "tv"), item(4), item(9, "tv"), item(10, "tv"), item(11, "tv"), item(12, "tv")],
  ], [pick(1), pick(2, "tv")], [pick(3)]);
  assert.equal(result.length, 9);
  assert.equal(new Set(result.map((row) => row.media_type + ":" + row.id)).size, 9);
  assert.ok(!result.some((row) => [1, 2, 3].includes(row.id)));
  assert.ok(result.slice(0, 4).some((row) => row.media_type === "tv"));
});

test("empty taste or unavailable catalogues don't invent starter picks", () => {
  assert.equal(selectStarterRecommendations([[item(1)]], [], []).length, 0);
  assert.equal(selectStarterRecommendations([], [pick(1)], []).length, 0);
  assert.equal(selectStarterRecommendations([[item(11)]], Array.from({ length: 10 }, (_, i) => pick(i + 1)), []).length, 1);
});

test("forty optional suggestions remain available after keeping all ten cards", () => {
  const result = selectStarterRecommendations([
    Array.from({ length: 60 }, (_, i) => item(i + 1)),
  ], Array.from({ length: 10 }, (_, i) => pick(i + 1)), []);
  assert.equal(result.length, 40);
  assert.equal(result[0].id, 11);
  assert.equal(result.at(-1).id, 50);
  assert.equal(parseOnboardingPicks(Array.from({ length: 50 }, (_, i) => pick(i + 1)), MAX_ONBOARDING_SELECTIONS).length, 50);
  assert.equal(parseOnboardingPicks(Array.from({ length: 51 }, (_, i) => pick(i + 1)), MAX_ONBOARDING_SELECTIONS), null);
});

test("small taste samples expand through cached related pages only as needed", async () => {
  const requests = [];
  const { getOnboardingSuggestions } = load("lib/onboarding-suggestions.ts", {
    "server-only": {},
    "@/lib/onboarding-recommendations": recommendationHelpers,
    "@/lib/tmdb": {
      getRecommendationsFor: async (type, id, page = 1) => {
        requests.push([type, id, page]);
        return Array.from({ length: 20 }, (_, i) => item((page - 1) * 20 + i + 1));
      },
      getSimilarFor: async () => { requests.push("similar"); return Array.from({ length: 20 }, (_, i) => item(i + 40)); },
    },
  });
  const result = await getOnboardingSuggestions([pick(1)], [pick(3)]);
  assert.equal(result.length, 40);
  assert.ok(result.every((row) => row.id !== 1 && row.id !== 3));
  assert.deepEqual(requests, [["movie", 1, 1], ["movie", 1, 2], "similar"]);
});

test("a full first page pool avoids extra catalogue calls", async () => {
  let requests = 0;
  const { getOnboardingSuggestions } = load("lib/onboarding-suggestions.ts", {
    "server-only": {},
    "@/lib/onboarding-recommendations": recommendationHelpers,
    "@/lib/tmdb": {
      getRecommendationsFor: async (_type, id, page = 1) => {
        assert.equal(page, 1); requests++;
        return Array.from({ length: 20 }, (_, i) => item(id * 100 + i));
      },
      getSimilarFor: async () => { throw new Error("Unnecessary request"); },
    },
  });
  assert.equal((await getOnboardingSuggestions([pick(1), pick(2), pick(3)], [])).length, 40);
  assert.equal(requests, 3);
  assert.equal((await getOnboardingSuggestions([], [])).length, 0);
  assert.equal(requests, 3);
});

test("a new release with few curated matches can fill forty from two similar pages", async () => {
  const { getOnboardingSuggestions } = load("lib/onboarding-suggestions.ts", {
    "server-only": {},
    "@/lib/onboarding-recommendations": recommendationHelpers,
    "@/lib/tmdb": {
      getRecommendationsFor: async () => [],
      getSimilarFor: async (_type, _id, page) => Array.from({ length: 20 }, (_, i) => item(page * 100 + i)),
    },
  });
  assert.equal((await getOnboardingSuggestions([pick(1)], [])).length, 40);
});

test("submission rejects malformed or oversized selections and keeps film/series IDs distinct", () => {
  for (const invalid of [null, {}, [pick(-1)], [pick(1, "person")], [pick(1.5)], Array.from({ length: 11 }, (_, i) => pick(i + 1))]) {
    assert.equal(parseOnboardingPicks(invalid), null);
  }
  assert.equal(parseOnboardingPicks([pick(1), pick(1), pick(1, "tv")]).length, 2);
});

test("old web sessions cannot access a recreated account, including legacy cookies", () => {
  const old = "2026-09-01T00:00:00.000Z";
  const fresh = "2026-09-29T00:00:00.000Z";
  assert.equal(belongsToAccount({ accountCreatedAt: old }, old), true);
  assert.equal(belongsToAccount({ accountCreatedAt: old }, fresh), false);
  assert.equal(belongsToAccount({ iat: Date.parse(old) / 1000 }, fresh), false);
  assert.equal(belongsToAccount({ iat: Date.parse(fresh) / 1000 }, old), true);
  assert.equal(belongsToAccount({}, fresh), false);
});

test("a valid native JWT is rejected after its device session is deleted or revoked", async () => {
  let session = { id: "device", revoked_at: null, expires_at: "2099-01-01T00:00:00Z" };
  const filters = [];
  const query = {
    select() { return this; },
    eq(key, value) { filters.push([key, value]); return this; },
    async maybeSingle() { return { data: session, error: null }; },
  };
  class NativeApiError extends Error { constructor(status, code, message) { super(message); this.status = status; } }
  const { issueAccessToken, authenticateNativeRequest } = load("lib/native-api/tokens.ts", {
    "server-only": {}, "node:crypto": crypto, jose,
    "@/lib/native-api/http": { NativeApiError },
    "@/lib/supabase": { supabase: { from: () => query } },
  });
  const token = await issueAccessToken({ ownerId: "a", sessionId: "device", platform: "ios" });
  const request = new Request("https://slate.test/api", { headers: { authorization: `Bearer ${token}` } });
  assert.equal((await authenticateNativeRequest(request)).ownerId, "a");
  assert.deepEqual(filters, [["id", "device"], ["owner_id", "a"]]);
  session = { ...session, revoked_at: new Date().toISOString() };
  await assert.rejects(authenticateNativeRequest(request), (error) => error.status === 401);
  session = null;
  await assert.rejects(authenticateNativeRequest(request), (error) => error.status === 401);
});

test("onboarding saves approved suggestions after kept picks and completes only after writes", async () => {
  const added = [];
  const positions = [];
  let completed = false;
  const { completeOnboarding } = load("lib/onboarding-actions.ts", {
    "next/cache": { revalidatePath() {} },
    "@/lib/actions": { addTitle: async (selection) => { added.push(selection.tmdbId); return { id: String(selection.tmdbId), status: "want" }; } },
    "@/lib/profiles": { getProfileById: async () => ({ onboarding_completed_at: completed ? "done" : null }) },
    "@/lib/onboarding-recommendations": recommendationHelpers,
    "@/lib/library-db": {
      getLibraryOwnerId: async () => "a",
      getLibraryClient: async () => ({ from: () => ({ update: (values) => ({ eq: async (_, id) => {
        positions.push([id, values.position]); return { error: null };
      } }) }) }),
    },
    "@/lib/supabase": { supabase: { from: () => ({ update: () => ({ eq: async (_, id) => {
      assert.equal(id, "a"); assert.equal(positions.length, 50); completed = true; return { error: null };
    } }) }) } },
  });
  const form = new FormData();
  form.set("selections", JSON.stringify(Array.from({ length: 50 }, (_, i) => pick(i + 1))));
  assert.equal((await completeOnboarding({}, form)).savedCount, 50);
  assert.deepEqual(added, Array.from({ length: 50 }, (_, i) => i + 1));
  assert.deepEqual(positions, Array.from({ length: 50 }, (_, i) => [String(i + 1), -1000 + i]));
  await completeOnboarding({}, form);
  assert.equal(added.length, 50, "Completed onboarding must not write twice");
});

const schema = fs.readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8")
  .replace('create extension if not exists "pgcrypto";', "");
const seed = `
insert into profiles (id, username, display_name) values ('a', 'alice', 'Alice'), ('b', 'bob', 'Bob');
insert into titles (id, owner_id, tmdb_id, media_type, title) values
 ('00000000-0000-4000-8000-000000000001', 'a', 1, 'movie', 'A title'),
 ('00000000-0000-4000-8000-000000000002', 'b', 2, 'movie', 'B title');
insert into lists (id, owner_id, slug, name) values
 ('00000000-0000-4000-8000-000000000003', 'a', 'alice-list', 'Alice list'),
 ('00000000-0000-4000-8000-000000000004', 'b', 'bob-list', 'Bob list');
insert into list_titles (owner_id, list_id, title_id) values
 ('a', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001'),
 ('b', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002');
insert into list_members (list_id, profile_id, invited_by) values
 ('00000000-0000-4000-8000-000000000003', 'b', 'a'),
 ('00000000-0000-4000-8000-000000000004', 'a', 'b');
insert into list_invites (list_id, token_hash, created_by, expires_at) values
 ('00000000-0000-4000-8000-000000000003', 'invite-a', 'a', now() + interval '1 day'),
 ('00000000-0000-4000-8000-000000000004', 'invite-b', 'b', now() + interval '1 day');
insert into preview_feedback (owner_id) values ('a'), ('b');
insert into account_emails (email_hash, owner_id) values ('hash-a', 'a'), ('hash-b', 'b');
insert into email_login_codes (email_hash, code_hash, expires_at) values ('hash-a', 'code-a', now()), ('hash-b', 'code-b', now());
insert into auth_identities (provider, provider_subject, owner_id) values ('google', 'a', 'a'), ('google', 'b', 'b');
insert into device_sessions (owner_id, refresh_token_hash, platform, expires_at) values ('a', 'device-a', 'ios', now()), ('b', 'device-b', 'android', now());
`;

test("account deletion runs against real PostgreSQL: ownership, FK cascades, and rollback", async () => {
  const db = new PGlite();
  try {
    await db.exec(schema);
    await db.exec(seed);
    // A failure halfway through leaves the entire account and library intact.
    await assert.rejects(db.transaction(async (tx) => deleteAccountData({
      query: (sql, params) => {
        if (sql.startsWith("delete from titles")) throw new Error("Simulated DB failure");
        return tx.query(sql, params);
      },
    }, "a", "hash-a")));
    assert.equal((await db.query("select * from lists where owner_id = 'a'")).rows.length, 1);
    assert.equal((await db.query("select * from email_login_codes where email_hash = 'hash-a'")).rows.length, 1);

    await db.transaction((tx) => deleteAccountData(tx, "a", "hash-a"));
    for (const table of ["titles", "lists", "list_titles", "preview_feedback", "account_emails", "auth_identities", "device_sessions"]) {
      assert.equal((await db.query("select * from " + table + " where owner_id = 'a'")).rows.length, 0, table);
      assert.equal((await db.query("select * from " + table + " where owner_id = 'b'")).rows.length, 1, table);
    }
    assert.equal((await db.query("select * from profiles")).rows.length, 1);
    assert.equal((await db.query("select * from list_members")).rows.length, 0);
    assert.equal((await db.query("select * from list_invites")).rows.length, 1);
    assert.equal((await db.query("select * from email_login_codes")).rows[0].email_hash, "hash-b");
    await db.query("insert into profiles (id, username, display_name) values ('a', 'alice', 'Alice')");
    assert.equal((await db.query("select onboarding_completed_at from profiles where id = 'a'")).rows[0].onboarding_completed_at, null);
    assert.equal((await db.query("select * from titles where owner_id = 'a'")).rows.length, 0);
  } finally { await db.close(); }
});

test("deletion action requires confirmation and uses the authenticated owner only", async () => {
  const deleted = [];
  let signedOut = 0;
  const { deleteAccount } = load("lib/account-actions.ts", {
    "next/cache": { revalidatePath() {} },
    "@/auth": { signOut: async () => { signedOut++; } },
    "@/lib/app-access": { getAppSession: async () => ({ user: { id: "a", email: "alice@example.com" } }) },
    "@/lib/email-auth-core": { accountEmailHash: () => "hash-a" },
    "@/lib/account-deletion": { deleteAccountData: async (_client, id) => { deleted.push(id); } },
    "@/lib/neon-client": { runNeonTransaction: async (work) => work({}) },
    "@/lib/profiles": { getProfileById: async () => ({ username: "alice" }) },
    "@/lib/public-mode": { SLATE_HOSTED: true },
  });
  const form = new FormData();
  form.set("ownerId", "b");
  assert.equal((await deleteAccount({}, form)).ok, false);
  assert.equal(deleted.length, 0);
  form.set("confirmation", "DELETE");
  assert.equal((await deleteAccount({}, form)).ok, true);
  assert.deepEqual(deleted, ["a"]);
  assert.equal(signedOut, 1);
});
