// Real UI + API + persistence, restricted to an explicitly supplied local server.
// Never run this write test against a hosted account or its public gallery.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Cdp, findChrome, launch } from '../cli/screenshot.ts';
import { polishExamples } from '../packs/polish-examples.ts';
const url=process.env.KAGES_GALLERY_E2E_URL;
test('publish from Library, explore and upvote in Gallery, then remove the listing',{skip:!url||!findChrome(),timeout:120000},async()=>{
 const api=async(op:string,args={})=>{const r=await fetch(url+'/api/'+op,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(args)});const data=await r.json();assert.ok(r.ok,JSON.stringify(data));return data;};
 assert.equal((await api('get_setup')).mode,'local','write tests require an isolated local server');
 const name='gallery-browser-'+Date.now(),doc={...polishExamples()[0],id:name,title:'Gallery browser fixture'};
 const made=await api('create_kage',{doc,repo:'gallery-tests'}),uuid=made.version.uuid;
 const browser=await launch(findChrome()!,process.env.KAGES_CHROME_NO_SANDBOX==='1'),cdp=await Cdp.connect(browser.wsUrl);
 try{
  const{targetId}=await cdp.send('Target.createTarget',{url:'about:blank'});const{sessionId}=await cdp.send('Target.attachToTarget',{targetId,flatten:true});await cdp.send('Page.enable',{},sessionId);
  const ev=async(expression:string)=>{const r=await cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);assert.equal(r.exceptionDetails,undefined,JSON.stringify(r.exceptionDetails));return r.result.value;};
  const wait=async(expression:string)=>{for(let i=0;i<300;i++){if(await ev(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error(expression);};
  const nav=async(path:string)=>{await cdp.send('Page.navigate',{url:url+path},sessionId);await wait('!!document.body');};
  const clickText=async(selector:string,label:string)=>ev(`[...document.querySelectorAll(${JSON.stringify(selector)})].find(x=>x.textContent.trim()===${JSON.stringify(label)}).click()`);
  const share=async()=>{await nav('/artifacts?id='+name);await wait("[...document.querySelectorAll('button')].some(x=>x.textContent.trim()==='Share')");await clickText('button','Share');};
  await share();await wait("[...document.querySelectorAll('[role=menuitem]')].some(x=>x.textContent.includes('Publish to gallery'))");await clickText('[role=menuitem]','Publish to gallery');
  await wait("document.body.innerText.includes('This Kage is now public')");
  assert.equal((await api('list_gallery')).items.find((c:any)=>c.uuid===uuid).upvotes,0);
  await nav('/gallery');await wait(`!!document.querySelector('[data-gallery-card="${uuid}"]')`);
  const vote=`document.querySelector('[data-gallery-card="${uuid}"] button[aria-pressed]')`;
  await ev(vote+'.click()');await wait(vote+".getAttribute('aria-pressed')==='true'");
  assert.equal((await api('list_gallery')).items.find((c:any)=>c.uuid===uuid).upvotes,1);
  await nav('/gallery');await wait(vote+"?.getAttribute('aria-pressed')==='true'");await ev(vote+'.click()');await wait(vote+".getAttribute('aria-pressed')==='false'");
  assert.equal((await api('list_gallery')).items.find((c:any)=>c.uuid===uuid).upvotes,0);
  for(const width of [1200,390]){
   await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390},sessionId);
   await new Promise(r=>setTimeout(r,250));assert.equal(await ev('document.documentElement.scrollWidth>innerWidth'),false);
   if(process.env.KAGES_GALLERY_SHOTS){mkdirSync(process.env.KAGES_GALLERY_SHOTS,{recursive:true});const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},sessionId);writeFileSync(`${process.env.KAGES_GALLERY_SHOTS}/gallery-${width}.png`,Buffer.from(shot.data,'base64'));}
  }
  await share();await wait("[...document.querySelectorAll('[role=menuitem]')].some(x=>x.textContent.includes('Remove from gallery'))");await clickText('[role=menuitem]','Remove from gallery');await wait("document.body.innerText.includes('Removed from the gallery')");
  assert.equal((await api('list_gallery')).items.some((c:any)=>c.uuid===uuid),false);
  assert.equal((await api('list_kages')).find((c:any)=>c.uuid===uuid).visibility,'public');
  await nav('/gallery');await wait("document.body.innerText.includes('The gallery starts with a shared idea.')");
 }finally{cdp.close();browser.stop();await api('delete_kage',{name});}
});
