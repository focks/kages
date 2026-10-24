// Real viewport and interaction checks catch ordering regressions that a valid
// block tree cannot reveal. Only browser-local document reads are substituted.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Cdp,findChrome,launch} from '../cli/screenshot.ts';
import {polishExamples} from '../packs/polish-examples.ts';
const url=process.env.KAGES_TEST_URL;
test('refined mobile viewer leads with data, restores controls and exposes import and presentation without overlays', {skip:!url||!findChrome(),timeout:60000},async()=>{
 const browser=await launch(findChrome()!,process.env.KAGES_CHROME_NO_SANDBOX==='1'),cdp=await Cdp.connect(browser.wsUrl);
 try{let child:string|undefined;cdp.on((m,p)=>{if(m==='Target.attachedToTarget'&&p.targetInfo.type==='iframe')child=p.sessionId;});
 const{targetId}=await cdp.send('Target.createTarget',{url:'about:blank'});const{sessionId}=await cdp.send('Target.attachToTarget',{targetId,flatten:true});
 await cdp.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:false,flatten:true},sessionId);await cdp.send('Page.enable',{},sessionId);
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true},sessionId);
 await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:`const f=fetch;window.fetch=(u,...a)=>String(u).startsWith('/api/shared/')?Promise.resolve(new Response(${JSON.stringify(JSON.stringify(polishExamples()[1]))})):f(u,...a);`},sessionId);
 const ev=async(expression:string,target=child!)=>{const r=await cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},target);assert.equal(r.exceptionDetails,undefined,JSON.stringify(r.exceptionDetails));return r.result.value;};
 const pause=()=>new Promise(r=>setTimeout(r,100));
 const wait=async(expression:string,target?:string)=>{for(let i=0;i<150;i++){if((target||child)&&await ev(expression,target??child!))return;await pause();}throw Error(expression);};
 await cdp.send('Page.navigate',{url:url+'/k/refined-fixture'},sessionId);
 await wait("!!document.querySelector('.kg-cartesian svg')");
 assert.ok(await ev("document.querySelector('.kg-cartesian svg').getBoundingClientRect().top < innerHeight-180"),'the opening viewport shows actual plotted data');
 assert.equal(await ev("getComputedStyle(document.querySelector('.kg-canvas__support')).display"),'none');
 await ev("document.querySelector('.kg-canvas__controls-toggle').click()");await wait("getComputedStyle(document.querySelector('.kg-canvas__support')).display==='grid'");
 await ev("document.querySelector('input[value=North]').click()");await wait("document.querySelectorAll('[data-point-id]').length===4");
 await ev("[...document.querySelectorAll('[role=tab]')].find(x=>x.textContent.includes('Data & import')).click()");await wait("!!document.querySelector('[data-block=import]')");
 await ev("[...document.querySelectorAll('button')].find(x=>x.textContent==='Import data').click()");await wait("document.body.innerText.includes('CSV imported by reader')");
 assert.ok(await ev("document.documentElement.scrollWidth<=innerWidth"));
 assert.equal(await ev("[...document.querySelectorAll('button')].some(x=>x.textContent.includes('Give feedback')&&x.checkVisibility())",sessionId),false);
 await ev("[...document.querySelectorAll('summary')].find(x=>x.textContent==='Use this Kage').click()",sessionId);
 await ev("[...document.querySelectorAll('button')].find(x=>x.textContent==='Presentation mode').click()",sessionId);
 await wait("document.querySelector('header').hidden",sessionId);
 assert.ok(await ev("document.querySelector('.kg-chart-frame').textContent.includes('CSV imported by reader')"),'presentation mode preserves session data');
 await ev("[...document.querySelectorAll('button')].find(x=>x.textContent==='Exit presentation').click()",sessionId);
 await wait("!document.querySelector('header').hidden",sessionId);
 }finally{cdp.close();browser.stop();}
});
