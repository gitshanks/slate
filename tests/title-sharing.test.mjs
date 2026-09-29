import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';

function load(file, dependencies = {}) {
  const output = ts.transpileModule(fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, {
    exports, URL, URLSearchParams, Error,
    require(name) {
      if (name in dependencies) return dependencies[name];
      throw new Error('Unexpected dependency: ' + name);
    },
  });
  return exports;
}
const helpers = load('lib/title-sharing.ts');

test('shared links accept catalogue IDs, never profile or arbitrary return URLs', () => {
  for (const [type, id] of [['person', 1], ['movie', 0], ['tv', -1], ['movie', '1e3'], ['movie', '01'], ['tv', '3/notes'], ['tv', 1.5], ['movie', 10000000000]]) {
    assert.equal(helpers.parseSharedTitle(type, id), null);
  }
  for (const path of ['https://evil.test', '//evil.test', '/\\evil.test', '/app', '/t/movie/1?next=//evil.test', '/t/movie/1#secret', '/u/private-user/title/secret']) {
    assert.equal(helpers.sharedTitleFromPath(path), null);
  }
  assert.equal(helpers.titleSharePath('movie', 42), '/t/movie/42');
  const login = new URL(helpers.sharedTitleLoginPath('tv', 42), 'https://slate.test');
  const onboarding = new URL(login.searchParams.get('next'), login);
  assert.equal(login.pathname, '/login');
  assert.equal(onboarding.pathname, '/onboarding');
  assert.equal(onboarding.searchParams.get('next'), '/t/tv/42');
  assert.equal(helpers.sharedTitleFromPath('/t/tv/42').tmdbId, 42);
});

test('shared catalogue data cannot expose a library identity, status, rating, or note', async () => {
  let calls = 0;
  const data = load('lib/shared-title-data.ts', {
    'server-only': {}, react: { cache: fn => fn }, '@/lib/title-sharing': helpers,
    '@/lib/tmdb': {
      getMovie: async id => { calls++; return { id }; },
      getTv: async id => { calls++; return { id }; },
      normalizeForStorage: (type, detail) => ({ tmdb_id: detail.id, media_type: type, title: 'A film', poster_path: null, backdrop_path: null, overview: 'Public plot', release_date: '2026-01-01', genres: [], owner_id: 'private', review: 'secret note', rating: 3, status: 'watched', favorite: true }),
    },
  });
  assert.equal(await data.getSharedTitle('bad', '1'), null);
  assert.equal(calls, 0);
  const result = await data.getSharedTitle('movie', '42');
  assert.equal(result.title, 'A film');
  for (const key of ['owner_id','review','rating','status','favorite']) assert.ok(!(key in result));
  assert.ok(!JSON.stringify(result).includes('secret'));
});

function actionFixture({ session = null, profile = null, fail = false } = {}) {
  const writes = [];
  let reads = 0;
  const action = load('lib/shared-title-actions.ts', {
    '@/lib/title-sharing': helpers,
    '@/lib/public-mode': { SLATE_HOSTED: true },
    '@/lib/app-access': { getAppSession: async () => { reads++; return session; } },
    '@/lib/profiles': { getProfileById: async () => profile },
    '@/lib/actions': { addTitle: async input => { writes.push(input); if (fail) throw new Error('DB unavailable'); return { id: 'saved-title', status: 'watched' }; } },
  });
  return { ...action, writes, reads: () => reads };
}

test('anonymous saves carry the title through sign-up without writing a library', async () => {
  const fixture = actionFixture();
  assert.equal((await fixture.saveSharedTitle('movie', -1)).ok, false);
  assert.equal(fixture.reads(), 0);
  const result = await fixture.saveSharedTitle('movie', 42);
  assert.equal(result.destination, helpers.sharedTitleLoginPath('movie', 42));
  assert.equal(fixture.writes.length, 0);
});

test('new accounts finish onboarding with a return to the recommendation', async () => {
  const fixture = actionFixture({ session: { user: { id: 'owner' } }, profile: { onboarding_completed_at: null, is_public: false } });
  const result = await fixture.saveSharedTitle('tv', 42);
  assert.equal(result.destination, helpers.sharedTitleOnboardingPath('tv', 42));
  assert.equal(fixture.writes.length, 0);
});

test('private accounts can save a public catalogue recommendation without changing visibility', async () => {
  const fixture = actionFixture({ session: { user: { id: 'owner' } }, profile: { onboarding_completed_at: 'done', is_public: false } });
  const result = await fixture.saveSharedTitle('movie', 42);
  assert.equal(result.ok, true);
  assert.equal(result.titleId, 'saved-title');
  assert.deepEqual(JSON.parse(JSON.stringify(fixture.writes)), [{ tmdbId: 42, mediaType: 'movie', status: 'want' }]);
});

test('save failures stay retryable and never report success', async () => {
  const fixture = actionFixture({ session: { user: { id: 'owner' } }, profile: { onboarding_completed_at: 'done' }, fail: true });
  const result = await fixture.saveSharedTitle('movie', 42);
  assert.equal(result.ok, false);
  assert.match(result.message, /Try again/);
  assert.ok(!result.destination);
});

function onboardingFixture(completed = false) {
  const deck = [{ tmdbId: 5, mediaType: 'tv' }, { tmdbId: 42, mediaType: 'movie' }, { tmdbId: 42, mediaType: 'tv' }];
  let lookups = 0;
  const page = load('app/onboarding/page.tsx', {
    'react/jsx-runtime': jsxRuntime,
    'next/navigation': { redirect: path => { throw new Error('redirect:' + path); } },
    '@/components/analytics/analytics-identity': { AnalyticsIdentity: 'identity' },
    '@/components/onboarding/onboarding-deck': { OnboardingDeck: 'deck' },
    '@/lib/app-access': { getAppSession: async () => ({ user: { id: 'owner' } }) },
    '@/lib/profiles': { getProfileById: async () => ({ id: 'owner', onboarding_completed_at: completed ? 'done' : null }) },
    '@/lib/public-mode': { SLATE_HOSTED: true },
    '@/lib/title-sharing': helpers,
    '@/lib/onboarding-titles': { getOnboardingTitles: async () => deck },
    '@/lib/shared-title-data': { getSharedTitle: async () => { lookups++; return { tmdb_id: 42, media_type: 'movie', title: 'A recommendation', overview: 'A plot', genres: [] }; } },
  });
  return { render: next => page.default({ searchParams: Promise.resolve({ next }) }), lookups: () => lookups };
}

test('onboarding starts with the shared title exactly once and keeps its return destination', async () => {
  const fixture = onboardingFixture();
  const element = await fixture.render('/t/movie/42');
  const props = element.props.children.find(child => child.type === 'deck').props;
  assert.equal(props.returnTo, '/t/movie/42');
  assert.equal(props.titles.length, 3);
  assert.equal(props.titles[0].title, 'A recommendation');
  assert.equal(props.titles.filter(title => title.tmdbId === 42 && title.mediaType === 'movie').length, 1);
  assert.ok(props.titles.some(title => title.tmdbId === 42 && title.mediaType === 'tv'));
});

test('onboarding rejects arbitrary destinations and completed accounts return without another deck', async () => {
  const fixture = onboardingFixture();
  const element = await fixture.render('//outside.test');
  assert.equal(element.props.children.find(child => child.type === 'deck').props.returnTo, '/app');
  assert.equal(fixture.lookups(), 0);
  const completed = onboardingFixture(true);
  await assert.rejects(completed.render('/t/tv/42'), /redirect:\/t\/tv\/42/);
  assert.equal(completed.lookups(), 0);
});
