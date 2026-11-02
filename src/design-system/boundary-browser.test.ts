// Real frame tests protect behaviours SSR cannot prove: selectable text,
// trusted native scrolling, measured glyph bounds and pinned design inheritance.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Cdp,findChrome,launch,screenshotDoc,DEFAULTS} from '../cli/screenshot.ts';
import {resolveDesign,paletteFromBrand,designContrast} from '../engine/design.ts';
import {contrast,hexToRgb} from './contrast.ts';
import type {KageDoc} from '../engine/types.ts';
const url=process.env.KAGES_TEST_URL;
const skip=!url||!findChrome();
const example=()=>JSON.parse(readFileSync('docs/examples/boundary-diagram.kage.json','utf8')) as KageDoc;
const design=resolveDesign({id:'forest-study',name:'Forest study',base:'core',colors:{light:{paper:'#e6f0e8',ink:'#183020','ink-muted':'#354a3a','line-control':'#857e6f',wire:'#355caa'},dark:{paper:'#132319',ink:'#e2f0e7','ink-muted':'#b5cbbb','line-control':'#8aa493',wire:'#a4bdf4'}}});
const pinned=()=>{const d=example();d.resolved={system:'core@1.19.0',blocks:{architecture:'core/boundary-diagram@1.0.0'},design};return d;};

async function inFrame(doc:KageDoc,run:(ev:(s:string,host?:boolean)=>Promise<any>,cdp:Cdp,child:string)=>Promise<void>,dark=false){
 const browser=await launch(findChrome()!,process.env.KAGES_CHROME_NO_SANDBOX==='1'),cdp=await Cdp.connect(browser.wsUrl);
 try{
  let child:string|undefined;cdp.on((m,p)=>{if(m==='Target.attachedToTarget'&&p.targetInfo.type==='iframe')child=p.sessionId;});
  const{targetId}=await cdp.send('Target.createTarget',{url:'about:blank'}),{sessionId}=await cdp.send('Target.attachToTarget',{targetId,flatten:true});
  await cdp.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:false,flatten:true},sessionId);
  await cdp.send('Page.enable',{},sessionId);await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:820,deviceScaleFactor:1,mobile:false},sessionId);
  const ev=async(s:string,host=false)=>{const r=await cdp.send('Runtime.evaluate',{expression:s,returnByValue:true,awaitPromise:true},host?sessionId:child!);assert.equal(r.exceptionDetails,undefined,JSON.stringify(r.exceptionDetails));return r.result.value;};
  const wait=async(s:string,host=false)=>{for(let i=0;i<150;i++){if((host||child)&&await ev(s,host))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+s);};
  await cdp.send('Page.navigate',{url:url+'/render'},sessionId);await wait('!!window.__kages?.ready',true);
  await ev(`window.__kages.render(${JSON.stringify(doc)},{dark:${dark}})`,true);await wait("!!document.querySelector('.kg-boundary')");
  await run(ev,cdp,child!);
 }finally{cdp.close();browser.stop();}
}

test('boundary text is selectable and trusted arrows scroll only the contained figure',{skip,timeout:60000},async()=>{
 await inFrame(example(),async(ev,cdp,child)=>{
  assert.equal(await ev(`(()=>{const t=document.querySelector('.kg-boundary__mono'),r=document.createRange(),s=getSelection();r.selectNodeContents(t);s.removeAllRanges();s.addRange(r);return s.toString()})()`),'read-only, metadata only');
  await ev("getSelection().removeAllRanges();document.querySelector('.kg-boundary__viewport').focus()");
  await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39},child);
  await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39},child);
  await new Promise(r=>setTimeout(r,250));
  assert.ok(await ev("document.querySelector('.kg-boundary__viewport').scrollLeft>0"));
  assert.equal(await ev('document.documentElement.scrollWidth'),390);assert.equal(await ev('document.documentElement.scrollWidth',true),390);
 });
});

test('screenshot reports text beyond a boundary card, while a healthy phone figure stays clean',{skip,timeout:60000},async()=>{
 const healthy=await screenshotDoc(example(),{...DEFAULTS,url,widths:[390],noSandbox:process.env.KAGES_CHROME_NO_SANDBOX==='1'});
 assert.deepEqual(healthy[0].issues,[]);
 const d=example();(d.blocks.architecture.props as any).cards[0].lines=[{text:'CLIPPED-TAIL '.repeat(50),y:280}];
 const [bad]=await screenshotDoc(d,{...DEFAULTS,url,widths:[390],noSandbox:process.env.KAGES_CHROME_NO_SANDBOX==='1'});
 assert.ok(bad.issues.some(s=>/text extends beyond.*@architecture: CLIPPED-TAIL/.test(s)),bad.issues.join('; '));
});

test('boundary canvas and content honour the workspace design pinned in the document',{skip,timeout:60000},async()=>{
 await inFrame(pinned(),async ev=>{
  assert.equal(await ev("getComputedStyle(document.querySelector('.kg-boundary__ground')).fill"),'rgb(230, 240, 232)');
  assert.equal(await ev("getComputedStyle(document.querySelector('.kg-boundary__mono')).fill"),'rgb(53, 74, 58)');
  assert.equal(await ev("getComputedStyle(document.querySelector('.kg-boundary__zone-label')).fill"),'rgb(53, 74, 58)');
  assert.equal(await ev("document.querySelector('.kg-kage').dataset.design"),'forest-study');
 });
});

test('render-only review reports a completely rejected boundary figure and text covered by a child', {skip,timeout:60000}, async()=>{
 const broken=example();(broken.blocks.architecture.props as any).edges[0].to='missing-card';
 const [failed]=await screenshotDoc(broken,{...DEFAULTS,url,widths:[1600],noSandbox:process.env.KAGES_CHROME_NO_SANDBOX==='1'});
 assert.ok(failed.issues.some(s=>/failed to render.*Invalid boundary diagram.*Unknown card/.test(s)),failed.issues.join('; '));
 const hidden=example();(hidden.blocks.architecture.props as any).cards[0].lines=[{text:'HIDDEN-BY-CHILD',y:110}];
 const [covered]=await screenshotDoc(hidden,{...DEFAULTS,url,widths:[390],noSandbox:process.env.KAGES_CHROME_NO_SANDBOX==='1'});
 assert.ok(covered.issues.some(s=>/hidden by a later rectangle.*HIDDEN-BY-CHILD/.test(s)),covered.issues.join('; '));
});

test('pinned ocean labels use text tokens while request strokes retain wire in both themes', {skip,timeout:60000}, async()=>{
 for(const [brand,dark] of [['#0f8a5f',false],['#c2410c',false],['#7c3aed',true]] as const){
  const palette=paletteFromBrand(brand)!;
  const snapshot=resolveDesign({id:'wire-study',name:'Wire study',base:'core',colors:palette});
  assert.deepEqual(designContrast(snapshot).filter(r=>!r.ok),[]);
  const mode=dark?'dark':'light';assert.ok(contrast(snapshot[mode].wire,snapshot[mode].paper)<4.5);
  const d=pinned();d.resolved!.design=snapshot;
  await inFrame(d,async ev=>{
   assert.equal(await ev("getComputedStyle(document.querySelector('.kg-boundary__edge-label.kg-palette-ocean')).fill"),await ev("getComputedStyle(document.querySelector('.kg-boundary__mono')).fill"));
   assert.equal(await ev("getComputedStyle(document.querySelector('.kg-boundary__edge.kg-palette-ocean')).color"),'rgb('+hexToRgb(snapshot[mode].wire)!.join(', ')+')');
  },dark);
 }
});

test('a boundary diagram inside a composition validates and renders through the actual frame', {skip,timeout:60000}, async()=>{
 const base=example();const d:KageDoc={kages:'1.0',id:'composed-boundary',title:'Composed boundary',system:'core',root:'instance',blocks:{instance:{type:'composition',props:{name:'drawing'}}},compositions:{drawing:{inputs:{},root:base.root,blocks:base.blocks}}};
 await inFrame(d,async ev=>{
  assert.equal(await ev("document.querySelectorAll('.kg-boundary').length"),1);
  assert.ok(await ev("document.querySelector('.kg-boundary').textContent.includes('Example workspace store')"));
 });
 const [shot]=await screenshotDoc(d,{...DEFAULTS,url,widths:[390],noSandbox:process.env.KAGES_CHROME_NO_SANDBOX==='1'});assert.deepEqual(shot.issues,[]);
});
