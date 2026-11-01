// Regression cases reproduce the review's trust and transaction failures through public APIs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from './store.ts';
import { sampleKage } from '../test-support/fixtures.ts';
import { dispatch } from '../adapters/operations.ts';
const alice = { principal: 'user:alice' }, bob = { principal: 'user:bob' };

test('patch identity cannot redirect a write, including root replacement and stale merges', () => {
  for (const root of [false, true]) for (const stale of [false, true]) {
    const s = new Store({ clock: () => 1000 });
    s.create('alice', sampleKage({ id: 'a' }), alice);
    s.create('bob', sampleKage({ id: 'b' }), bob);
    if (stale) s.patch('a', [{ op: 'replace', path: '/title', value: 'new title' }], alice);
    const before = s.snapshot();
    const ops = [{ op: 'replace', path: root ? '' : '/id', value: root ? sampleKage({ id: 'b' }) : 'b' }];
    const params = { name: 'a', ops, ...(stale ? { baseVersion: 1 } : {}) };
    const dry = dispatch({ store: s, author: alice }, 'validate_patch', params);
    assert.equal((dry as any).data.ok, false);
    assert.equal(dispatch({ store: s, author: alice }, 'patch_kage', params).ok, false);
    assert.deepEqual(s.snapshot().kages, before.kages);
    assert.deepEqual(s.snapshot().grants, before.grants);
  }
});

test('failed namespace creation rolls back its ownership grant', () => {
  const s = new Store({ clock: () => 1000 }); const before = s.snapshot();
  assert.equal(s.create('new', sampleKage({ root: 'missing' }), alice).ok, false);
  assert.deepEqual(s.snapshot(), before);
});

test('all version reads and snapshots detach signed content and provenance', () => {
  const s = new Store({ clock: () => 1000 }); const author = { ...alice };
  const created = s.create('r', sampleKage({ id: 'a' }), author);
  const expected = s.head('a');
  const read = s.authorizeRead('a', alice);
  for (const v of [created.version!, s.head('a')!, s.getVersion('a', 1)!, s.versions('a')[0], s.list()[0], s.search({})[0], read.ok ? read.record : null]) {
    assert.ok(v); v.doc.title = 'tampered'; v.author.principal = 'tampered';
  }
  author.principal = 'changed input';
  const snap = s.snapshot(); const restored = Store.restore(snap);
  snap.kages[0].versions[0].doc.title = 'tampered snapshot';
  assert.deepEqual(s.head('a'), expected); assert.deepEqual(restored.head('a'), expected);
});

test('dry-run and write agree at capacity and missing-design boundaries', () => {
  for (const design of [false, true]) {
    const s = new Store({ clock: () => 1000 }); s.create('r', sampleKage({ id: 'a' }), alice);
    const target = design ? s : Store.restore(s.snapshot(), { maxWorkspaceChars: s.snapshot().documentChars! });
    const ops = [{ op: 'add' as const, path: design ? '/design' : '/description', value: design ? 'absent' : 'more bytes' }];
    const before = target.snapshot(); const dry = target.checkPatch('a', ops, alice); const actual = target.patch('a', ops, alice);
    assert.equal(dry.ok, false); assert.equal(actual.ok, false); assert.equal(dry.error?.code, actual.error?.code);
    assert.deepEqual(target.snapshot(), before);
  }
});

test('cached capacity survives restore, appends and deletion, including legacy snapshots', () => {
  const s = new Store({ clock: () => 1000 });
  s.create('r', sampleKage({ id: 'a' }), alice);
  s.patch('a', [{ op: 'replace', path: '/title', value: 'second' }], alice);
  const snapshot = s.snapshot();
  const total = snapshot.kages.flatMap(k => k.versions).reduce((n, v) => n + JSON.stringify(v.doc).length, 0);
  assert.equal(snapshot.documentChars, total);
  delete snapshot.documentChars;
  const restored = Store.restore(snapshot, { clock: () => 1000 });
  assert.equal(restored.snapshot().documentChars, total);
  restored.remove('a', alice);
  assert.equal(restored.snapshot().documentChars, 0);
});
