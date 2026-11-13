import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file) {
  const output = ts.transpileModule(fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, module: { exports }, URL, URLSearchParams, Date, JSON, encodeURIComponent, decodeURIComponent });
  return exports;
}

const { resolveSignupSource, decodeSignupSource, encodeSignupSource } = load('lib/signup-source.ts');
const base = { search: '', referrer: '', userAgent: 'Mozilla/5.0 Safari', ownHost: 's1ate.space', path: '/' };

test('UTM source wins and aliases normalise', () => {
  const s = resolveSignupSource({ ...base, search: '?utm_source=IG&utm_campaign=Film-115', referrer: 'https://t.co/x' });
  assert.equal(s.source, 'instagram');
  assert.equal(s.campaign, 'film-115');
  assert.equal(s.referrerHost, 't.co');
});

test('Instagram in-app browser is recognised without a referrer', () => {
  const s = resolveSignupSource({ ...base, userAgent: 'Mozilla/5.0 (iPhone) Instagram 300.0.0' });
  assert.equal(s.source, 'instagram');
  assert.equal(s.inApp, 'instagram');
});

test('referrer hosts map to names, own host and empty are direct', () => {
  assert.equal(resolveSignupSource({ ...base, referrer: 'https://l.instagram.com/?u=x' }).source, 'instagram');
  assert.equal(resolveSignupSource({ ...base, referrer: 'https://www.google.co.uk/' }).source, 'google');
  assert.equal(resolveSignupSource({ ...base, referrer: 'https://blog.example.org/post' }).source, 'blog.example.org');
  assert.equal(resolveSignupSource({ ...base, referrer: 'https://s1ate.space/login' }).source, 'direct');
  assert.equal(resolveSignupSource(base).source, 'direct');
});

test('cookie round-trips and rejects junk', () => {
  const s = resolveSignupSource({ ...base, search: '?utm_source=tiktok' });
  assert.equal(decodeSignupSource(encodeSignupSource(s)).source, 'tiktok');
  assert.equal(decodeSignupSource('not json'), null);
  assert.equal(decodeSignupSource(encodeURIComponent('{"source":""}')), null);
  assert.equal(decodeSignupSource(encodeURIComponent(JSON.stringify({ source: 'x'.repeat(500) }))).source.length, 80);
});
