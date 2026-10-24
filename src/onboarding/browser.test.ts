// Browser status is separate from the agent credential. Exercise the checklist
// with anonymous, connected and unavailable responses without initiating OAuth.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Cdp,findChrome,launch } from '../cli/screenshot.ts';
const url=process.env.KAGES_TEST_URL;
test('onboarding distinguishes browser readiness from agent setup on phone and desktop',{skip:!url||!findChrome(),timeout:60000},async()=>{
 const browser=await launch(findChrome()!,process.env.KAGES_CHROME_NO_SANDBOX==='1'),cdp=await Cdp.connect(browser.wsUrl);
 try{const{targetId}=await cdp.send('Target.createTarget',{url:'about:blank'});const{sessionId}=await cdp.send('Target.attachToTarget',{targetId,flatten:true});
 await cdp.send('Page.enable',{},sessionId);
 await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:`window.__setup={ready:false,mode:'cloud',workspace:null};const original=fetch;window.fetch=(u,...args)=>String(u)==='/api/get_setup'?Promise.resolve(new Response(JSON.stringify(window.__setup),{status:window.__setup.error?503:200})):original(u,...args);`},sessionId);
 const ev=async(expression:string)=>{const r=await cdp.send('Runtime.evaluate',{expression,returnByValue:true},sessionId);assert.equal(r.exceptionDetails,undefined,JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async(expression:string)=>{for(let i=0;i<100;i++){if(await ev(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error(expression);};
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true},sessionId);await cdp.send('Page.navigate',{url:url+'/onboarding'},sessionId);
 await wait("!!document.body");
 await wait("document.body.innerText.includes('This browser is not signed in')");assert.ok(await ev("!!document.querySelector('a[href=\"/login?next=%2Fonboarding\"]')"));
 assert.ok(await ev("document.body.innerText.includes('Verify the agent separately')"));
 await ev("[...document.querySelectorAll('button')].find(x=>x.textContent==='MCP without install').click()");await wait("document.body.innerText.includes('npx -y --package=')");
 assert.ok(await ev("document.documentElement.scrollWidth<=innerWidth"));
 await ev("window.__setup={ready:true,mode:'cloud',workspace:'test-personal'};[...document.querySelectorAll('button')].find(x=>x.textContent==='Recheck workspace').click()");await wait("document.body.innerText.includes('Browser connected to test-personal')");
 assert.ok(await ev("document.body.innerText.includes('This checks the browser only')"));
 await ev("window.__setup={error:{msg:'workspace storage unavailable; retry later'}};[...document.querySelectorAll('button')].find(x=>x.textContent==='Recheck workspace').click()");await wait("document.body.innerText.includes('workspace storage unavailable')");
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:1200,height:900,deviceScaleFactor:1,mobile:false},sessionId);assert.ok(await ev("document.documentElement.scrollWidth<=innerWidth"));
 }finally{cdp.close();browser.stop();}
});
