// PDF export must contain the final section, not just the viewer's first screen.
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Cdp, findChrome, launch } from '../cli/screenshot.ts';
import { polishExamples } from '../packs/polish-examples.ts';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import assert from 'node:assert/strict';
const url = process.env.KAGES_TEST_URL;
let textTool = false;
try { execFileSync('pdftotext', ['-v'], { stdio: 'ignore' }); textTool = true; } catch {}
test('published print view exports all sections over multiple pages', { skip: !url || !findChrome() || !textTool ? 'Requires KAGES_TEST_URL, Chrome and pdftotext' : false, timeout: 60000 }, async () => {
const directory = mkdtempSync(join(tmpdir(), 'kages-print-'));
const path = join(directory, 'review.pdf');
const doc=polishExamples()[0];doc.blocks.root.props!.appearance='light';
for(let i=0;i<30;i++){const id='paragraph'+i;doc.blocks[id]={type:'text',props:{text:'Print section '+i+' — '+('Readable evidence and supporting explanation. '.repeat(8))}};doc.blocks.root.slots!.children.push(id);}
doc.blocks.last={type:'text',props:{text:'FINAL PRINT MARKER: all thirty sections reached the PDF.'}};doc.blocks.root.slots!.children.push('last');
const browser=await launch(findChrome()!, process.env.KAGES_CHROME_NO_SANDBOX === '1'),cdp=await Cdp.connect(browser.wsUrl);
try {
const {targetId}=await cdp.send('Target.createTarget',{url:'about:blank'});const {sessionId}=await cdp.send('Target.attachToTarget',{targetId,flatten:true});
await cdp.send('Page.enable',{},sessionId);
await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:`const originalFetch=window.fetch;window.fetch=(url,...args)=>String(url).startsWith('/api/shared/')?Promise.resolve(new Response(${JSON.stringify(JSON.stringify(doc))})):originalFetch(url,...args);`},sessionId);
await cdp.send('Page.navigate',{url:url+'/k/print-test?print=1'},sessionId);
const ev=async (expression: string)=>(await cdp.send('Runtime.evaluate',{expression,returnByValue:true},sessionId)).result.value;
let ready=false;for(let i=0;i<120;i++){if(await ev("document.querySelector('iframe')?.getBoundingClientRect().height>3000 && [...document.querySelectorAll('button')].some(b=>b.textContent==='Print / save PDF'&&!b.disabled)")){ready=true;break;}await new Promise(r=>setTimeout(r,150));}
assert.ok(ready);
await new Promise(r=>setTimeout(r,300));
const result=await cdp.send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true},sessionId);
writeFileSync(path,Buffer.from(result.data,'base64'));
const text = execFileSync('pdftotext', [path, '-'], { encoding: 'utf8' });
assert.match(text, /FINAL PRINT MARKER/);
assert.match(text, /Print section 0/);
assert.match(text, /Print section 29/);
assert.ok(text.split('\f').length > 2);
}finally{cdp.close();browser.stop();rmSync(directory, { recursive: true, force: true });}
});
