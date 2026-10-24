// Exercise the public viewer with a local API fixture. The test uses genuine
// keyboard/wheel input and never publishes or mutates a user's workspace.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Cdp, findChrome, launch } from "../cli/screenshot.ts";
import { polishExamples } from "../packs/polish-examples.ts";
const url = process.env.KAGES_TEST_URL;
const chrome = findChrome();
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

test("analytical report supports selection, scenario/reset, mobile bars and wheel scrolling", { skip: !url || !chrome ? "Set KAGES_TEST_URL and install Chrome" : false, timeout: 60000 }, async () => {
  const browser = await launch(chrome!, process.env.KAGES_CHROME_NO_SANDBOX === "1");
  const cdp = await Cdp.connect(browser.wsUrl);
  try {
    let child: string | undefined;
    cdp.on((method, params) => { if (method === "Target.attachedToTarget" && params.targetInfo.type === "iframe") child = params.sessionId; });
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const evaluate = async (expression: string, target = child!) => {
      const result = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, target);
      assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails)); return result.result.value;
    };
    await cdp.send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: false, flatten: true }, sessionId);
    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: "Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__copiedView=text;}}});" }, sessionId);
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 800, deviceScaleFactor: 1, mobile: false }, sessionId);
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `const originalFetch=window.fetch;window.fetch=(url,...args)=>String(url).startsWith('/api/shared/')?Promise.resolve(new Response(${JSON.stringify(JSON.stringify(polishExamples()[0]))})):originalFetch(url,...args);` }, sessionId);
    await cdp.send("Page.navigate", { url: url + "/k/polish-fixture" }, sessionId);
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (child && await evaluate("!!document.querySelector('.kg-analytical-bars__row')")) { ready = true; break; }
      await delay(150);
    }
    assert.ok(ready, "public viewer renders the native analytical report");
    await cdp.send("Page.bringToFront", {}, sessionId);
    const color = await evaluate("getComputedStyle(document.querySelector('.kg-analytical-bars__bar')).backgroundColor");
    await evaluate("document.querySelector('.kg-analytical-bars__row').focus()");
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r", unmodifiedText: "\r" }, sessionId);
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 }, sessionId); await delay(100);
    assert.equal(await evaluate("document.querySelector('.kg-analytical-bars__row').getAttribute('aria-pressed')"), "true");
    assert.ok(await evaluate("document.body.innerText.includes('Selected: Services workflow')"));
    await evaluate("document.querySelector('input[value=alternate]').click()"); await delay(100);
    assert.ok(await evaluate("document.querySelector('.kg-analytical-bars__value').textContent.includes('90K')"));
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.kg-analytical-bars__bar')).backgroundColor"), color);
    await evaluate("[...document.querySelectorAll('summary')].find(b=>b.textContent==='Use this Kage').click()", sessionId);
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Copy link to this view').click()", sessionId);
    await delay(100);
    const shared = await evaluate("window.__copiedView", sessionId);
    assert.ok(shared.includes("~view="), "sharing includes the allowed scenario and selection");
    child = undefined;
    await cdp.send("Page.navigate", { url: shared }, sessionId);
    await cdp.send("Page.reload", {}, sessionId);
    ready = false;
    for (let i = 0; i < 100; i++) {
      if (child && await evaluate("document.querySelector('.kg-analytical-bars__value')?.textContent.includes('90K')")) { ready = true; break; }
      await delay(100);
    }
    assert.ok(ready);
    assert.ok(await evaluate("document.querySelector('.kg-analytical-bars__value').textContent.includes('90K')"), "a fresh view restores the scenario: " + shared + " → " + await evaluate("document.querySelector('.kg-analytical-bars__value').textContent"));
    assert.equal(await evaluate("document.querySelector('.kg-analytical-bars__row').getAttribute('aria-pressed')"), "true", "a fresh view restores selection");
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Reset exploration').click()"); await delay(100);
    assert.ok(await evaluate("document.querySelector('.kg-analytical-bars__value').textContent.includes('120K')"));
    assert.equal(await evaluate("document.querySelector('.kg-analytical-bars__row').getAttribute('aria-pressed')"), "false");
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, sessionId); await delay(200);
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.kg-analytical-bars__track')).gridRowStart"), "2");
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
    await evaluate("window.scrollTo(0,0)");
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 180, y: 400, deltaX: 0, deltaY: 400 }, sessionId); await delay(250);
    assert.ok(await evaluate("scrollY") > 0, "wheel input scrolls the public report");
  } finally { cdp.close(); browser.stop(); }
});


test("plot and graph controls work in the public viewer", { skip: !url || !chrome ? "Set KAGES_TEST_URL and install Chrome" : false, timeout: 60000 }, async () => {
  const doc = polishExamples()[0];
  doc.blocks.root.slots!.children = ["plot", "graph"];
  doc.blocks.plot = { type: "line-chart", props: { label: "Sample trend", interactive: true, rangeControls: true, colorDomain: ["A", "B"], items: [{id:"a",x:1,y:2,series:"A"},{id:"b",x:5,y:8,series:"A"},{id:"c",x:1,y:4,series:"B"},{id:"d",x:5,y:6,series:"B"}] } };
  doc.blocks.graph = { type: "diagram", props: {label:"Sample graph",explore:true,nodes:[{id:"source",label:"Source",group:"Inputs"},{id:"model",label:"Model",group:"Inputs"},{id:"reader",label:"Reader",group:"Outputs"}],edges:[{from:"source",to:"model"},{from:"model",to:"reader"}]} };
  const browser = await launch(chrome!, process.env.KAGES_CHROME_NO_SANDBOX === "1");
  const cdp = await Cdp.connect(browser.wsUrl);
  try {
    let child: string | undefined;
    cdp.on((method, params) => { if (method === "Target.attachedToTarget" && params.targetInfo.type === "iframe") child = params.sessionId; });
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const evaluate = async (expression: string) => {
      const r = await cdp.send("Runtime.evaluate", {expression,awaitPromise:true,returnByValue:true}, child!);
      assert.equal(r.exceptionDetails,undefined,JSON.stringify(r.exceptionDetails));return r.result.value;
    };
    await cdp.send("Target.setAutoAttach",{autoAttach:true,waitForDebuggerOnStart:false,flatten:true},sessionId);
    await cdp.send("Page.enable",{},sessionId);
    await cdp.send("Page.addScriptToEvaluateOnNewDocument",{source:`const originalFetch=window.fetch;window.fetch=(url,...args)=>String(url).startsWith('/api/shared/')?Promise.resolve(new Response(${JSON.stringify(JSON.stringify(doc))})):originalFetch(url,...args);`},sessionId);
    await cdp.send("Page.navigate",{url:url+"/k/plot-graph-fixture"},sessionId);
    let ready=false;for(let i=0;i<100;i++){if(child && await evaluate("!!document.querySelector('.kg-graph-explorer')")){ready=true;break;}await delay(150);}
    assert.ok(ready);await cdp.send("Page.bringToFront",{},sessionId);
    await evaluate("document.querySelector('[data-point-id=b]').focus()");
    await cdp.send("Input.dispatchKeyEvent",{type:"keyDown",key:"Enter",code:"Enter"},sessionId);await delay(100);
    assert.equal(await evaluate("document.querySelector('[data-point-id=b]').getAttribute('aria-pressed')"),"true");
    await evaluate("document.querySelector('.kg-cartesian__legend').click()");await delay(100);
    assert.equal(await evaluate("document.querySelectorAll('[data-point-id]').length"),2);
    await evaluate("document.querySelector('.kg-cartesian__legend').click()");await delay(100);
    assert.equal(await evaluate("document.querySelectorAll('[data-point-id]').length"),4);
    await evaluate("document.querySelector('.kg-cartesian__range summary')?.click(); document.querySelector('.kg-cartesian__range input').focus()");
    await cdp.send("Input.dispatchKeyEvent",{type:"keyDown",key:"ArrowRight",code:"ArrowRight",windowsVirtualKeyCode:39},sessionId);
    await cdp.send("Input.dispatchKeyEvent",{type:"keyUp",key:"ArrowRight",code:"ArrowRight",windowsVirtualKeyCode:39},sessionId);await delay(100);
    assert.ok(await evaluate("Number(document.querySelector('.kg-cartesian__range input').value)")>1);
    await evaluate("document.querySelector('.kg-cartesian__range button').click()");await delay(100);
    assert.equal(await evaluate("Number(document.querySelector('.kg-cartesian__range input').value)"),1);
    await evaluate("document.querySelector('[aria-label=\"Zoom in\"]').click()");await delay(100);
    assert.equal(await evaluate("document.querySelector('.kg-graph-explorer output').textContent"),"125%");
    await evaluate("[...document.querySelectorAll('.kg-graph-explorer__groups button')].find(b=>b.textContent==='Collapse Inputs').click()");await delay(100);
    assert.ok(await evaluate("document.querySelector('.kg-graph-explorer').textContent.includes('Inputs · 2 nodes')"));
    await evaluate("document.querySelector('.kg-graph-explorer input[type=search]').focus()");
    await cdp.send("Input.insertText",{text:"Reader"},sessionId);await delay(100);
    assert.equal(await evaluate("document.querySelector('.kg-graph-explorer__matches p').textContent"),"1 matching nodes");
    await evaluate("document.querySelector('.kg-graph-explorer__matches button').click()");await delay(100);
    assert.ok(await evaluate("!!document.querySelector('.kg-graph-explorer [aria-pressed=true]')"));
    await evaluate("[...document.querySelectorAll('.kg-graph-explorer__tools button')].find(b=>b.textContent==='Fit graph').click()");await delay(100);
    assert.ok(await evaluate("parseInt(document.querySelector('.kg-graph-explorer output').textContent)")<=100);
    await cdp.send("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:1,mobile:true},sessionId);await delay(150);
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"),true);
    assert.ok(await evaluate("document.querySelector('.kg-cartesian > svg').getBoundingClientRect().width")<390);
  } finally {cdp.close();browser.stop();}
});
