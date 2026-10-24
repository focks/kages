// Public reading and the sign-in prompt are separate from the authorized copy write.
import { test } from 'node:test';
import { Cdp, findChrome, launch } from '../cli/screenshot.ts';
import { polishExamples } from '../packs/polish-examples.ts';
import assert from 'node:assert/strict';
const origin=process.env.KAGES_TEST_URL;
const local=origin && ['localhost','127.0.0.1'].includes(new URL(origin).hostname);
test('public copy prompts anonymous readers then preserves content in an independent draft', {skip: !local || !findChrome() ? 'Requires local KAGES_TEST_URL and Chrome' : false, timeout: 60000}, async()=>{
const doc=polishExamples()[0];
const browser=await launch(findChrome()!,process.env.KAGES_CHROME_NO_SANDBOX==='1'),cdp=await Cdp.connect(browser.wsUrl);let copyId: string | undefined;
try{
const {targetId}=await cdp.send('Target.createTarget',{url:'about:blank'}),{sessionId}=await cdp.send('Target.attachToTarget',{targetId,flatten:true});await cdp.send('Page.enable',{},sessionId);await cdp.send('Network.enable',{},sessionId);cdp.on((method,params)=>{if(method==='Network.requestWillBeSent'&&params.request.url.endsWith('/api/create_kage'))copyId=JSON.parse(params.request.postData).doc.id;});
await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:`window.denyCopy=true;const originalFetch=window.fetch;window.fetch=(url,...args)=>String(url).startsWith('/api/shared/')?Promise.resolve(new Response(${JSON.stringify(JSON.stringify(doc))})):String(url)==='/api/create_kage'&&window.denyCopy?Promise.resolve(new Response(JSON.stringify({error:{msg:'Sign in'}}),{status:401})):originalFetch(url,...args);`},sessionId);
const ev=async (expression: string)=>(await cdp.send('Runtime.evaluate',{expression,returnByValue:true},sessionId)).result.value;
const wait=async (expression: string)=>{for(let i=0;i<120;i++){if(await ev(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error(expression);};
await cdp.send('Page.navigate',{url:origin+'/k/copy-fixture'},sessionId);
await wait("[...document.querySelectorAll('summary')].some(s=>s.textContent==='Use this Kage')");
await ev("[...document.querySelectorAll('summary')].find(s=>s.textContent==='Use this Kage').click()");
await ev("[...document.querySelectorAll('button')].find(b=>b.textContent==='Make a copy').click()");
await wait("document.body.innerText.includes('Sign in to save a copy')");
assert.ok(await ev("document.querySelector('a[href*=login]')?.href.includes('next=')"));
await ev("window.denyCopy=false;[...document.querySelectorAll('button')].find(b=>b.textContent==='Make a copy').click()");
for(let i=0;i<150;i++){const {targetInfo}=await cdp.send('Target.getTargetInfo',{targetId});const destination=targetInfo.url?new URL(targetInfo.url).searchParams.get('id'):null;if(destination){copyId=destination;break;}await new Promise(r=>setTimeout(r,100));}
assert.ok(copyId); assert.ok(copyId.startsWith('copy-'));
const response=await fetch(origin+'/api/get_kage?name='+encodeURIComponent(copyId));const copy=await response.json();assert.deepEqual(copy.data,doc.data);assert.deepEqual(copy.blocks,doc.blocks);assert.equal(copy.title,doc.title+' copy');assert.notEqual(copy.id,doc.id);
}finally{cdp.close();browser.stop();if(copyId)await fetch(origin+'/api/delete_kage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:copyId})});}

});
