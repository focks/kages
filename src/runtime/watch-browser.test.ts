// `watch` handlers ran only in the headless session: the browser's dispatch skipped them,
// so a document that passed every check silently did nothing for real readers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Cdp, findChrome, launch } from '../cli/screenshot.ts';

const url = process.env.KAGES_TEST_URL;
const doc = {
  kages: '1.0', id: 'watch-fixture', title: 'Watch', system: 'core@1', root: 'root', state: { count: 0, echoed: 'no' },
  blocks: {
    root: { type: 'stack', slots: { children: ['go', 'out'] } },
    go: { type: 'button', props: { label: 'Go' }, on: { click: [{ do: 'set', path: 'count', value: 1 }] }, watch: { count: [{ do: 'set', path: 'echoed', value: 'yes' }] } },
    out: { type: 'text', props: { text: '' }, bind: { text: { $tpl: 'echoed: {{state.echoed}}' } } },
  },
};

test('a watch handler runs in the browser after the state it watches changes', { skip: !url || !findChrome(), timeout: 60000 }, async () => {
  const browser = await launch(findChrome()!, process.env.KAGES_CHROME_NO_SANDBOX === '1'), cdp = await Cdp.connect(browser.wsUrl);
  try {
    let child: string | undefined;
    cdp.on((m, p) => { if (m === 'Target.attachedToTarget' && p.targetInfo.type === 'iframe') child = p.sessionId; });
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true }, sessionId);
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `const f=fetch;window.fetch=(u,...a)=>String(u).startsWith('/api/shared/')?Promise.resolve(new Response(${JSON.stringify(JSON.stringify(doc))})):f(u,...a);` }, sessionId);
    const ev = async (expression: string) => (await cdp.send('Runtime.evaluate', { expression, returnByValue: true }, child!)).result.value;
    const wait = async (expression: string) => { for (let i = 0; i < 300; i++) { if (child && await ev(expression)) return; await new Promise((r) => setTimeout(r, 100)); } throw Error(expression); };
    await cdp.send('Page.navigate', { url: url + '/k/watch-fixture' }, sessionId);
    await wait("document.body.innerText.includes('echoed: no')");
    await ev("[...document.querySelectorAll('button')].find(b=>b.textContent==='Go').click()");
    await wait("document.body.innerText.includes('echoed: yes')");
    assert.ok(await ev("document.body.innerText.includes('echoed: yes')"));
  } finally { cdp.close(); browser.stop(); }
});
