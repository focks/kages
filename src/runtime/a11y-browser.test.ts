// One block fix improves every Kage, so the gate runs axe over rendered pages covering the
// common blocks. Serious and critical violations fail; lesser ones are left to review.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Cdp, findChrome, launch } from '../cli/screenshot.ts';
import { polishExamples } from '../packs/polish-examples.ts';

const url = process.env.KAGES_TEST_URL;
const axe = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

for (const doc of polishExamples().slice(0, 2)) {
  test(`no serious accessibility violations: ${doc.id}`, { skip: !url || !findChrome(), timeout: 60000 }, async () => {
    const browser = await launch(findChrome()!, process.env.KAGES_CHROME_NO_SANDBOX === '1'), cdp = await Cdp.connect(browser.wsUrl);
    try {
      let child: string | undefined;
      cdp.on((m, p) => { if (m === 'Target.attachedToTarget' && p.targetInfo.type === 'iframe') child = p.sessionId; });
      const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
      await cdp.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true }, sessionId);
      await cdp.send('Page.enable', {}, sessionId);
      await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `const f=fetch;window.fetch=(u,...a)=>String(u).startsWith('/api/shared/')?Promise.resolve(new Response(${JSON.stringify(JSON.stringify(doc))})):f(u,...a);` }, sessionId);
      const ev = async (expression: string) => (await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, child!)).result.value;
      await cdp.send('Page.navigate', { url: url + '/k/a11y-fixture' }, sessionId);
      for (let i = 0; i < 300; i++) { if (child && await ev("!!document.querySelector('[data-block]')")) break; await new Promise((r) => setTimeout(r, 100)); }
      await ev(axe);
      const found = await ev("axe.run(document,{resultTypes:['violations']}).then(r=>r.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id+': '+v.nodes.slice(0,3).map(n=>n.target.join(' ')).join(', ')))");
      assert.deepEqual(found, []);
    } finally { cdp.close(); browser.stop(); }
  });
}
