// A real Library review, apply and undo using an isolated, disposable local Kage.
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { Cdp, findChrome, launch } from '../cli/screenshot.ts';
import { polishExamples } from '../packs/polish-examples.ts';
import assert from 'node:assert/strict';
const origin = process.env.KAGES_TEST_URL;
const local = origin && ['localhost', '127.0.0.1'].includes(new URL(origin).hostname);
test('Library polish previews, saves and undoes a version', { skip: !local || !findChrome() ? 'Requires a local KAGES_TEST_URL and Chrome' : false, timeout: 90000 }, async () => {
const doc=polishExamples()[0]; doc.id='polish-browser-review-'+randomUUID();
const call=async(op: string,p: Record<string, unknown>)=>{const r=await fetch(origin+'/api/'+op,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(p)});const d=await r.json();if(!r.ok)throw Error(JSON.stringify(d));return d;};
const created=await call('create_kage',{doc});
const browser=await launch(findChrome()!, process.env.KAGES_CHROME_NO_SANDBOX === '1'),cdp=await Cdp.connect(browser.wsUrl);
try {
 const {targetId}=await cdp.send('Target.createTarget',{url:'about:blank'}); const {sessionId}=await cdp.send('Target.attachToTarget',{targetId,flatten:true});
 await cdp.send('Page.enable',{},sessionId);
 const evaluate=async(expression: string)=>{const r=await cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async(expression: string)=>{for(let i=0;i<120;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,150));}throw Error('Timeout '+expression);};
 await cdp.send('Page.navigate',{url:origin+'/artifacts?id='+doc.id},sessionId);
 await wait("[...document.querySelectorAll('summary')].some(s=>s.textContent==='Polish presentation')");
 await evaluate("[...document.querySelectorAll('summary')].find(s=>s.textContent==='Polish presentation').click()");
 await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Preview changes').click()");
 await wait("[...document.querySelectorAll('button')].some(b=>b.textContent==='Save polished version')");
 assert.ok(await evaluate("document.body.innerText.includes('source v1')"));
 await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Use phone width').click()");
 await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Show original').click()");
 await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Show proposed').click()");
 await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Save polished version').click()");
 await wait("document.body.innerText.includes('Saved as version 2') && [...document.querySelectorAll('button')].some(b=>b.textContent==='Undo polish in a new version' && !b.disabled)");
 await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Undo polish in a new version').click()");
 await wait("![...document.querySelectorAll('button')].some(b=>b.textContent==='Undo polish in a new version')");
 const versions=await call('list_versions',{name:doc.id});
 assert.equal(versions.length,3);
 const after=await call('get_kage',{name:doc.id});assert.deepEqual(after.blocks.root,doc.blocks.root);
 assert.equal(after.id, doc.id);
} finally {cdp.close();browser.stop();await call('delete_kage',{name:doc.id});}

});
