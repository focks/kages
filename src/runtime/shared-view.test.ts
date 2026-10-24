import { test } from 'node:test';
import assert from 'node:assert/strict';
import { polishExamples } from '../packs/polish-examples.ts';
import { docWithSharedView, shareKeys, sharedView, viewHash } from './shared-view.ts';
import { chapterFromHash } from './guide-navigation.ts';

test('share links restore allowed scalar controls without changing published data or chapter routes', () => {
  const doc = polishExamples()[0];
  const hash = viewHash(doc, { scenario: 'alternate', selected: 'Applications', rows: [{ secret: true }] }, '#overview');
  const restored = docWithSharedView(doc, hash);
  assert.equal(restored.state?.scenario, 'alternate');
  assert.equal(doc.state?.scenario, 'baseline');
  assert.equal(restored.data, doc.data);
  assert.equal(restored.state?.rows, undefined);
  assert.equal(chapterFromHash(hash, ['overview']), 'overview');
  assert.equal(chapterFromHash(viewHash(doc, restored.state!, ''), ['overview']), 'overview');
});

test('malformed, oversized, prototype, unapproved and persisted state cannot be restored', () => {
  const doc = polishExamples()[0];
  doc.meta = { shareState: ['scenario', 'selected', 'constructor', 'rows', 'missing'] };
  doc.persist = { selected: 'personal' };
  assert.deepEqual(shareKeys(doc), ['scenario']);
  for (const hash of ['#~view=%', '#~view=null', '#~view=[]', '#~view=' + 'a'.repeat(4001)]) assert.deepEqual(sharedView(doc, hash), {});
  const hostile = '#~view=' + encodeURIComponent('{"scenario":{},"selected":"private","__proto__":{"polluted":true}}');
  assert.deepEqual(sharedView(doc, hostile), {});
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
  assert.deepEqual(sharedView(doc, '#~view=' + encodeURIComponent('{"scenario":120}')), {});
});

test('long unicode selections stay within the decoder bound', () => {
  const doc = polishExamples()[0];
  doc.state = Object.fromEntries(Array.from({length:12}, (_,i)=>['key'+i, '']));
  doc.meta = {shareState:Object.keys(doc.state)};
  const state=Object.fromEntries(Object.keys(doc.state).map(key=>[key,'界'.repeat(120)]));
  const hash=viewHash(doc,state,'');
  assert.ok(hash.split('~view=')[1].length<=4000);
  assert.ok(Object.keys(sharedView(doc,hash)).length>0);
});
