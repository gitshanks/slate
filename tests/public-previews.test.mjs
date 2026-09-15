import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as crypto from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));

function load(relative, imports, globals = {}) {
  const source = fs.readFileSync(path.join(testDirectory, '..', relative), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, {
    exports, URL, Response, Request, Set, console,
    process: { env: { TMDB_API_KEY: 'fixture-only' } },
    require: (name) => {
      if (name in imports) return imports[name];
      throw new Error(`Unexpected dependency: ${name}`);
    },
    ...globals,
  });
  return exports;
}

function catalogueHarness({ missingTrailerLookups = 0 } = {}) {
  let accountReads = 0;
  let videoLookups = 0;
  const calls = [];
  const makeItem = (id) => ({
    id, media_type: 'movie', title: `Fixture ${id}`, overview: 'Fixture synopsis',
    poster_path: null, backdrop_path: null, release_date: '2026-09-01',
    popularity: 100, vote_average: 8, vote_count: 100, genre_ids: [18],
  });
  const tmdb = load('lib/tmdb.ts', {
    'server-only': {}, react: { cache: (fn) => fn }, '@/lib/tmdb-image': {},
    '@/lib/library-db': { getLibraryClient: () => { accountReads++; throw new Error('Account read'); } },
  }, {
    fetch: async (url, options) => {
      calls.push({ path: url.pathname, options });
      const page = Number(url.searchParams.get('page') || 1);
      if (url.pathname.endsWith('/videos')) return Response.json({ results: videoLookups++ < missingTrailerLookups ? [] : [
        { key: 'teaser', site: 'YouTube', type: 'Teaser', official: true, name: 'Teaser' },
        { key: `trailer-${url.pathname.split('/')[3]}`, site: 'YouTube', type: 'Trailer', official: true, name: 'Official trailer' },
      ] });
      const offset = url.pathname.includes('trending') ? 0 : 30;
      return Response.json({ results: Array.from({ length: 20 }, (_, i) => makeItem(offset + (page - 1) * 20 + i + 1)) });
    },
  });
  return { tmdb, calls, accountReads: () => accountReads };
}

test('public feed shares ranking, refresh intervals, and exclusions without account access', async () => {
  const { tmdb, calls, accountReads } = catalogueHarness();
  const options = { includeLibrary: false, sessionSeed: 'visitor-a', targetSize: 24, lookupLimit: 24, waveSize: 12 };
  const first = await tmdb.getPreviewFeedBatch(new Set(['movie:1']), options);
  assert.equal(accountReads(), 0);
  assert.equal(first.items.length, 24);
  const ids = first.items.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(!ids.includes(1));
  assert.deepEqual(new Set(first.items.map((item) => item.source)), new Set(['trending', 'now_playing']));
  assert.ok(first.items.every((item) => item.videoKey.startsWith('trailer-')));
  const repeat = await tmdb.getPreviewFeedBatch(new Set(['movie:1']), options);
  assert.equal(JSON.stringify(first), JSON.stringify(repeat));
  const rotated = await tmdb.getPreviewFeedBatch(new Set(['movie:1']), { ...options, sessionSeed: 'visitor-b' });
  assert.notEqual(JSON.stringify(ids), JSON.stringify(rotated.items.map((item) => item.id)));
  const next = await tmdb.getPreviewFeedBatch(new Set(first.attemptedKeys), { ...options, batchIndex: 1 });
  assert.ok(next.items.every((item) => !ids.includes(item.id)));
  assert.ok(first.attemptedKeys.length <= 24);
  for (const call of calls) {
    assert.equal(call.options.cache, 'force-cache');
    assert.equal(call.options.next.revalidate, call.path.endsWith('/videos') ? 86400 : call.path.includes('trending') ? 21600 : 43200);
  }
  await tmdb.getPreviewFeedBatch(new Set(), { sessionSeed: 'account-default' });
  assert.ok(accountReads() > 0, 'normal app still includes library recommendations');
});

test('public route validates requests and explicitly opts out of library access', async () => {
  const calls = [];
  const route = load('app/api/public/previews/route.ts', {
    'node:crypto': crypto,
    '@/lib/tmdb': { getPreviewFeedBatch: async (excluded, options) => {
      calls.push({ excluded, options }); return { items: [], attemptedKeys: [] };
    } },
  });
  for (const query of ['seed=', `seed=${'a'.repeat(129)}`, 'batch=-1', 'batch=1.5', 'batch=10001', 'batch=Infinity', 'batch=oops', 'exclude=person:1', 'exclude=movie:0', `exclude=${Array(241).fill('movie:1').join(',')}`]) {
    assert.equal((await route.GET(new Request(`http://localhost/api/public/previews?${query}`))).status, 400);
  }
  assert.equal(calls.length, 0);
  const response = await route.GET(new Request('http://localhost/api/public/previews?seed=visitor-a&batch=2&exclude=movie:1,tv:2'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(calls[0].options.includeLibrary, false);
  assert.equal(calls[0].options.sessionSeed, 'visitor-a');
  assert.equal(calls[0].options.batchIndex, 2);
  assert.equal(calls[0].options.targetSize, 24);
  assert.equal(calls[0].options.lookupLimit, 24);
  assert.equal(calls[0].options.waveSize, 12);
  assert.deepEqual([...calls[0].excluded], ['movie:1', 'tv:2']);

  const fullHistory = Array.from({ length: 240 }, (_, index) => `movie:${index + 1}`);
  const fullHistoryResponse = await route.GET(new Request(`http://localhost/api/public/previews?seed=visitor-a&batch=10000&exclude=${fullHistory.join(',')}`));
  assert.equal(fullHistoryResponse.status, 200);
  assert.equal(calls[1].excluded.size, 240);
  assert.equal(calls[1].options.batchIndex, 10000);
});

test('public route continues through the catalogue with the app batch size', async () => {
  const { tmdb, accountReads } = catalogueHarness();
  const route = load('app/api/public/previews/route.ts', {
    'node:crypto': crypto,
    '@/lib/tmdb': tmdb,
  });
  const history = new Set();
  const played = new Set();
  const batchSizes = [];
  for (let batch = 0; batch < 5; batch++) {
    const query = new URLSearchParams({ seed: 'visitor-a', batch: String(batch), exclude: [...history].join(',') });
    const response = await route.GET(new Request(`http://localhost/api/public/previews?${query}`));
    assert.equal(response.status, 200);
    const result = await response.json();
    batchSizes.push(result.items.length);
    assert.ok(result.attemptedKeys.length <= 24);
    for (const item of result.items) {
      const key = `${item.media_type}:${item.id}`;
      assert.ok(!played.has(key), `Continuation repeated ${key}`);
      played.add(key);
    }
    result.attemptedKeys.forEach((key) => history.add(key));
  }
  assert.deepEqual(batchSizes, [24, 24, 22, 0, 0]);
  assert.equal(played.size, 70, 'all eligible catalogue titles are reachable across refills');
  assert.equal(accountReads(), 0);
});

test('an empty hydration batch preserves continuation keys for untried candidates', async () => {
  const { tmdb } = catalogueHarness({ missingTrailerLookups: 24 });
  const route = load('app/api/public/previews/route.ts', {
    'node:crypto': crypto,
    '@/lib/tmdb': tmdb,
  });
  const firstResponse = await route.GET(new Request('http://localhost/api/public/previews?seed=visitor-a&batch=0'));
  const first = await firstResponse.json();
  assert.deepEqual(first.items, []);
  assert.equal(first.attemptedKeys.length, 24);
  assert.equal(Object.hasOwn(first, 'hasMore'), false, 'zero playable trailers must not imply catalogue exhaustion');

  const query = new URLSearchParams({ seed: 'visitor-a', batch: '1', exclude: first.attemptedKeys.join(',') });
  const nextResponse = await route.GET(new Request(`http://localhost/api/public/previews?${query}`));
  const next = await nextResponse.json();
  assert.equal(next.items.length, 24);
  assert.ok(next.attemptedKeys.every((key) => !first.attemptedKeys.includes(key)));
});

