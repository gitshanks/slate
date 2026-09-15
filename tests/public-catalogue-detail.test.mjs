import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
function load(relative, imports, globals = {}) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, {
    exports, URL, Response, Request, console,
    process: { env: { TMDB_API_KEY: 'fixture-only' } },
    require(name) {
      if (name in imports) return imports[name];
      throw new Error(`Unexpected dependency: ${name}`);
    },
    ...globals,
  });
  return exports;
}

test('public detail cache deduplicates requests and reuses completed metadata', async () => {
  let calls = 0;
  const cache = load('lib/public-catalogue-detail-cache.ts', {}, {
    fetch: async (url) => {
      calls++;
      assert.equal(url, '/api/public/catalogue/movie/42');
      return Response.json({ summary: 'Cached catalogue summary', savedTitle: null });
    },
  });
  const title = { media_type: 'movie', tmdb_id: 42 };
  const first = cache.loadPublicCatalogueDetail(title);
  const second = cache.loadPublicCatalogueDetail(title);
  assert.equal(first, second);
  await first;
  await cache.loadPublicCatalogueDetail(title);
  assert.equal(calls, 1);
  assert.equal(cache.getCachedPublicCatalogueDetail(title).summary, 'Cached catalogue summary');
  cache.clearPublicCatalogueDetailCache();
  assert.equal(cache.getCachedPublicCatalogueDetail(title), null);
  await cache.loadPublicCatalogueDetail(title);
  assert.equal(calls, 2);
});

test('public catalogue uses shared metadata serialization with no account reads or saved data', async () => {
  let accountReads = 0;
  const tmdb = load('lib/tmdb.ts', {
    'server-only': {}, react: { cache: (fn) => fn }, '@/lib/tmdb-image': {},
    '@/lib/library-db': { getLibraryClient() { accountReads++; throw new Error('Account access'); } },
  }, {
    fetch: async (url) => Response.json({
      id: Number(url.pathname.split('/').at(-1)), title: 'Fixture film', name: 'Fixture series',
      original_title: 'Fixture film', original_name: 'Fixture series', overview: 'Catalogue plot.',
      poster_path: '/poster.jpg', backdrop_path: '/backdrop.jpg', release_date: '2026-09-01',
      first_air_date: '2026-09-01', runtime: 112, episode_run_time: [42],
      imdb_id: 'tt1234567', external_ids: { imdb_id: 'tt1234567' },
      genres: [{ id: 18, name: 'Drama' }], vote_average: 8, vote_count: 123,
      tagline: 'Catalogue tagline', seasons: [{ season_number: 1, episode_count: 8 }],
      owner_id: 'must-not-leak', review: 'must-not-leak', rating: 5, favorite: true,
      videos: { results: [{ key: 'official-trailer', site: 'YouTube', type: 'Trailer', official: true }] },
      credits: {
        cast: [{ id: 5, name: 'Actor', character: 'Role', profile_path: null, order: 1 }],
        crew: [{ id: 6, name: 'Director', job: 'Director', profile_path: null }],
      },
      recommendations: { results: [{ id: 3, title: 'Related film', media_type: 'movie', poster_path: null, backdrop_path: null }] },
      'watch/providers': { results: { US: { link: 'https://example.com/watch', flatrate: [{ provider_id: 1, provider_name: 'Provider', logo_path: '/provider.jpg' }] } } },
    }),
  });
  const omdb = { getOmdbMetadata: async () => ({ omdb_plot: 'Full plot.', imdb_rating: 8.2, imdb_votes: 250, rt_score: 90, metacritic_score: 80 }) };
  const spatial = load('lib/spatial-title-detail.ts', {
    'server-only': {}, '@/lib/tmdb': tmdb, '@/lib/omdb': omdb,
    '@/lib/plot-format': load('lib/plot-format.ts', {}),
  });
  const catalogue = load('lib/public-catalogue-detail.ts', {
    'server-only': {}, '@/lib/tmdb': tmdb, '@/lib/omdb': omdb,
    '@/lib/spatial-title-detail': spatial,
  });
  for (const mediaType of ['movie', 'tv']) {
    const result = await catalogue.buildPublicCatalogueDetail(mediaType, 1);
    assert.equal(accountReads, 0);
    assert.equal(result.savedTitle, null);
    assert.equal(result.resolvedTitle.media_type, mediaType);
    assert.equal(result.resolvedTitle.id, `discover-${mediaType}-1`);
    assert.equal(result.resolvedTitle.runtime, mediaType === 'movie' ? 112 : 42);
    assert.equal(result.resolvedTitle.rating, null);
    assert.equal(result.resolvedTitle.review, null);
    assert.equal(result.resolvedTitle.favorite, false);
    assert.ok(!('owner_id' in result.resolvedTitle));
    assert.ok(!JSON.stringify(result).includes('must-not-leak'));
    assert.equal(result.summary, 'Full plot.');
    assert.equal(result.resolvedTitle.imdb_rating, 8.2);
    assert.equal(result.trailerKey, 'official-trailer');
    assert.equal(result.cast[0].subtitle, 'Role');
    assert.equal(result.crew[0].subtitle, 'Director');
    assert.equal(result.recommendations[0].tmdbId, 3);
    assert.equal(result.watchProviders.providers[0].name, 'Provider');
  }
});

test('public catalogue endpoint validates input and caches only catalogue responses', async () => {
  const calls = [];
  let fail = false;
  const route = load('app/api/public/catalogue/[type]/[tmdbId]/route.ts', {
    '@/lib/public-catalogue-detail': {
      async buildPublicCatalogueDetail(type, id) {
        calls.push({ type, id });
        if (fail) throw new Error('Provider unavailable');
        return { savedTitle: null, summary: 'Catalogue plot' };
      },
    },
  });
  const request = new Request('http://localhost/api/public/catalogue/movie/1');
  for (const [type, tmdbId] of [['person', '1'], ['movie', '0'], ['movie', '-1'], ['tv', '1.5'], ['movie', 'Infinity'], ['movie', '12345678901']]) {
    assert.equal((await route.GET(request, { params: Promise.resolve({ type, tmdbId }) })).status, 400);
  }
  assert.equal(calls.length, 0);
  const response = await route.GET(request, { params: Promise.resolve({ type: 'movie', tmdbId: '1' }) });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Cache-Control'), /^public, /);
  assert.equal((await response.json()).savedTitle, null);
  assert.deepEqual(calls, [{ type: 'movie', id: 1 }]);
  fail = true;
  const failure = await route.GET(request, { params: Promise.resolve({ type: 'movie', tmdbId: '1' }) });
  assert.equal(failure.status, 503);
  assert.equal(failure.headers.get('Cache-Control'), null);
});
