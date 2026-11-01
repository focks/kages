// Local history-growth probe: serialized bytes approximate transfer size, not database latency.
import { performance } from 'node:perf_hooks';
import { Store } from '../src/store/store.ts';
const author = { principal: 'service:benchmark' };
for (const count of [1, 100, 1000]) {
  const store = new Store({ clock: () => 1000, versionQuotaPerHour: 10000 });
  const doc = { kages: '1.0', id: 'history', title: 'History', system: 'core', root: 'text', blocks: { text: { type: 'text', props: { text: 'x'.repeat(1024) } } } };
  if (!store.create('bench', doc, author).ok) throw new Error('benchmark creation failed');
  for (let i = 1; i < count; i++) {
    if (!store.patch('history', [{ op: 'replace', path: '/title', value: `Revision ${i}` }], author).ok) throw new Error('benchmark write failed');
  }
  const snapshot = store.snapshot(), start = performance.now();
  const restored = Store.restore(snapshot, { clock: () => 1000, versionQuotaPerHour: 10000 });
  const restoreMs = performance.now() - start, writeStart = performance.now();
  if (!restored.patch('history', [{ op: 'replace', path: '/title', value: 'Measured write' }], author).ok) throw new Error('measured write failed');
  console.log(JSON.stringify({ versions: count, snapshotBytes: Buffer.byteLength(JSON.stringify(snapshot)), restoreMs, writeMs: performance.now() - writeStart }));
}
