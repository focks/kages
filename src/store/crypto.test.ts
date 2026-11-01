// Signatures must distinguish every JSON-owned key, including prototype-looking keys.
import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalize, digest } from "./crypto.ts";

test("canonicalization preserves __proto__ as data and remains key-order independent", () => {
  const hostile = JSON.parse('{"__proto__":{"x":1},"a":2}');
  assert.notEqual(digest(hostile), digest({ a: 2 }));
  assert.deepEqual(JSON.parse(canonicalize(hostile)), hostile);
  assert.equal(digest({ b: 2, a: 1 }), digest({ a: 1, b: 2 }));
  assert.equal(({} as Record<string, unknown>).x, undefined);
});

test('provenance verification rejects altered authorship and ancestry but allows publication transitions', async () => {
  const { Store } = await import('./store.ts');
  const { sampleKage } = await import('../test-support/fixtures.ts');
  const { importKey, verifyVersion } = await import('./crypto.ts');
  const s = new Store(); const author = { principal: 'user:a' };
  const v = s.create('r', sampleKage(), author).version!;
  const key = importKey(s.snapshot().keys[0][1]).publicKey;
  assert.equal(verifyVersion(key, v), true);
  assert.equal(verifyVersion(key, { ...v, author: { principal: 'user:forged' } }), false);
  assert.equal(verifyVersion(key, { ...v, parent: 'forged' }), false);
  assert.equal(verifyVersion(key, { ...v, state: 'published', visibility: 'public' }), true);
});

test('encrypted signer exports round-trip, reject wrong keys and require a production secret', async () => {
  const { exportKey, importKey, newSigningKey, signDigest, verifyDigest } = await import('./crypto.ts');
  const previous = process.env.KAGES_SIGNING_KEY_SECRET, mode = (process.env as Record<string, string | undefined>).NODE_ENV;
  try {
    process.env.KAGES_SIGNING_KEY_SECRET = 'ab'.repeat(32);
    const key = newSigningKey('test'), sealed = exportKey(key);
    assert.equal(sealed.privatePem, undefined); assert.ok(sealed.encryptedPrivatePem);
    assert.equal(verifyDigest(key.publicKey, 'message', signDigest(importKey(sealed), 'message')), true);
    process.env.KAGES_SIGNING_KEY_SECRET = 'cd'.repeat(32);
    assert.throws(() => importKey(sealed));
    delete process.env.KAGES_SIGNING_KEY_SECRET; (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    assert.throws(() => exportKey(key), /required/);
  } finally {
    if (previous === undefined) delete process.env.KAGES_SIGNING_KEY_SECRET; else process.env.KAGES_SIGNING_KEY_SECRET = previous;
    if (mode === undefined) delete (process.env as Record<string, string | undefined>).NODE_ENV; else (process.env as Record<string, string | undefined>).NODE_ENV = mode;
  }
});
