// Export checks use real resolved bindings so copied content cannot drift to
// initial data, diagnostic state dumps, or silently abbreviated chart rows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kageMarkdown } from './markdown.ts';
import { polishExamples } from '../packs/polish-examples.ts';
import { outlineToKage } from '../engine/outline.ts';
import { readFileSync } from 'node:fs';
import type { KageDoc } from '../engine/types.ts';
const page = (blocks: KageDoc['blocks']): KageDoc => ({ kages:'1.0', id:'export', title:'Reading copy', system:'core', root:'root', blocks:{root:{type:'page',slots:{children:Object.keys(blocks)}},...blocks} });

test('Markdown copies source prose, code, citations, tables and FAQ without shortening the document', () => {
 const source=readFileSync(new URL('../engine/__fixtures__/outline-sample.md',import.meta.url),'utf8');
 const {doc}=outlineToKage(source);const {markdown}=kageMarkdown(doc);
 for(const b of Object.values(doc.blocks)){
  const p=b.props as any;
  if(b.type==='markdown')assert.ok(markdown.includes(p.text));
  if(b.type==='code-tabs')for(const t of p.tabs)assert.ok(markdown.includes(t.code));
 }
 assert.match(markdown,/Snowflake/);assert.match(markdown,/\| ---/);
 assert.doesNotMatch(markdown,/get_setup|\$data|\$state|kages\.contract/);
});

test('current bindings and visibility are copied without private state or hidden/unreachable content', () => {
 const doc=page({body:{type:'text',bind:{text:{$state:'display'}}},hidden:{type:'text',props:{text:'hidden prose'},visible:{$state:'show'}},data:{type:'table',props:{columns:[{key:'id',label:'ID'},{key:'n',label:'Value'},{key:'s',label:'Text'}]},bind:{rows:{$state:'rows'}}}});
 doc.state={display:'initial',show:false,privateSecret:'never copy',rows:[]};
 doc.blocks.orphan={type:'text',props:{text:'unreachable prose'}};
 const before=JSON.stringify(doc);
 const {markdown}=kageMarkdown(doc,{display:'A long paragraph '.repeat(30),rows:[{id:'00123',n:0,s:'a|b\nnext'},{id:'00124',n:null,s:'<script>literal</script>'}]});
 assert.ok(markdown.includes('A long paragraph '.repeat(30)));
 assert.match(markdown,/00123 \| 0 \| a\\\|b<br>next/);assert.match(markdown,/00124 \|  \| &lt;script&gt;/);
 assert.doesNotMatch(markdown,/initial|never copy|hidden prose|unreachable prose/);assert.equal(JSON.stringify(doc),before);
});

test('all chart families retain categorical labels, exact data, source notes and diagram relationships', () => {
 const doc=page({
  heat:{type:'heatmap',props:{label:'By region',rows:['North'],columns:['2026','2027'],values:[[0,3]],source:'Measured results'}},
  stack:{type:'stacked-bar-chart',props:{label:'Quarterly',categories:['Q1','Q2'],series:[{name:'Blue',values:[12,23]},{name:'Green',values:[34,45]}]}},
  funnel:{type:'funnel-chart',props:{label:'Steps',stages:[{label:'Arrived',value:321}]}},
  sankey:{type:'sankey',props:{label:'Flow',nodes:[{id:'a',label:'Source'},{id:'b',label:'Target'}],links:[{from:'a',to:'b',value:123.456789}]}},
  graph:{type:'diagram',props:{label:'Dependency',nodes:[{id:'a',label:'Collect',x:0,y:0},{id:'b',label:'Review'}],edges:[{from:'a',to:'b',label:'approved by'}]}},
  failed:{type:'bar-chart',props:{label:'Unavailable series',items:[{label:'must not appear',value:55}],status:'error',statusMessage:'Source offline'}},
 });
 const {markdown}=kageMarkdown(doc);
 for(const s of ['| Row | 2026 | 2027 |','| North | 0 | 3 |','| Category | Blue | Green |','| Q2 | 23 | 45 |','Arrived | 321','a | b | 123.456789','a | b | approved by','Source: Measured results','Source offline'])assert.ok(markdown.includes(s),s);
 assert.doesNotMatch(markdown,/must not appear/);
});

test('rich code fences, attributed quotes and unsafe link destinations stay readable', () => {
 const {markdown}=kageMarkdown(page({
  rich:{type:'rich-text',props:{nodes:[{kind:'paragraph',runs:[{text:'a`b',code:true},{text:'1',cite:'source'}]},{kind:'quote',text:'A quotation',attribution:'Researcher',href:'https://example.com/paper'}]}},
  code:{type:'code',props:{code:'```\nbody\n```',language:'md'}},
  link:{type:'link',props:{label:'Keep label',href:'javascript:evil()'}},
 }));
 assert.match(markdown,/`` a`b ``\[1\]/);assert.match(markdown,/> A quotation/);assert.match(markdown,/\[Researcher\]\(https:\/\/example.com\/paper\)/);
 assert.ok(markdown.includes('````md\n```\nbody\n```\n````'));assert.doesNotMatch(markdown,/javascript:/);assert.match(markdown,/Keep label/);
});

test('tabs include named alternatives and all rows; a closed modal remains excluded', () => {
 const doc=page({tabs:{type:'tab-panel',props:{label:'Alternatives',tabs:[{id:'one',label:'First option'},{id:'two',label:'Second option'}]},slots:{panel1:['a'],panel2:['b']}},a:{type:'text',props:{text:'First content'}},b:{type:'text',props:{text:'Second content'}},modal:{type:'modal',props:{label:'Hidden overlay',open:false},slots:{children:['hidden']}},hidden:{type:'text',props:{text:'Secret modal body'}}});
 doc.blocks.root.slots={children:['tabs','modal']};
 const {markdown}=kageMarkdown(doc);for(const s of ['First option','Second option','First content','Second content'])assert.ok(markdown.includes(s));assert.doesNotMatch(markdown,/Secret modal body/);
});

test('all showcase documents export and current scenario values replace their initial values', () => {
 for(const doc of polishExamples())assert.ok(kageMarkdown(doc).markdown.length>500,doc.id);
 const {markdown}=kageMarkdown(polishExamples()[0],{scenario:'alternate',selected:''});
 assert.match(markdown,/90000/);assert.doesNotMatch(markdown,/\| 120000 \|/);
});

test('oversized output fails explicitly instead of copying a partial document', () => {
 assert.throws(()=>kageMarkdown(page({body:{type:'text',props:{text:'x'.repeat(2_000_001)}}})),/clipboard export limit/);
});
