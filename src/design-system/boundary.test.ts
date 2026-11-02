// Exercise the installed contract and real renderer, rather than a parallel
// test registry that could hide missing exports. See oracle/boundary.feature.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { boundaryCss, BOUNDARY_PALETTE } from './presentation.ts';
import { contrast } from './contrast.ts';
import { allExamples } from '../packs/curated-examples.ts';
const window: any = { React };
runInNewContext(readFileSync(new URL('../../public/ds/bundle.js', import.meta.url), 'utf8'), { window, console, Intl });
const K = window.Kages;
const props = () => ({ label: 'Service boundaries', width: 800, height: 400,
  zones: [{ id: 'local', label: 'Local sources', x: 10, y: 10, width: 780, height: 380 }],
  cards: [{ id: 'source', x: 30, y: 50, width: 200, height: 200, title: 'Sources', subtitle: 'metadata only', lines: [{ text: '<script>literal</script>', y: 85, font: 'mono' }], children: [{ id: 'queue', x: 16, y: 110, width: 168, height: 60, lines: [{ text: 'queued', y: 24 }] }] }, { id: 'store', title: 'Store', x: 420, y: 50, width: 340, height: 200 }],
  edges: [{ from: 'queue', to: 'store', fromSide: 'right', toSide: 'left', label: 'loads', labelX: 300, labelY: 130, style: 'dashed', palette: 'amber', arrows: 'both', via: [[300, 190], [300, 150]] }] });
const doc = (p = props()) => ({ id: 'boundary-test', kages: '1.0', system: 'core', root: 'map', blocks: { map: { type: 'boundary-diagram', props: p } } });
test('boundary contract declares structured geometry and renders literal selectable text in every system', () => {
  assert.ok(K.contracts['core/boundary-diagram@1.0.0']);
  for (const system of ['core', 'ledger', 'atelier']) {
    const d = { ...doc(), system };
    assert.equal(K.validate(d).ok, true, JSON.stringify(K.validate(d).errors));
    const html = renderToStaticMarkup(React.createElement(K.KageRenderer, { doc: d }));
    assert.match(html, /kg-boundary__viewport/); assert.match(html, /&lt;script&gt;literal/);
    assert.match(html, /stroke-dasharray="8 6"/); assert.equal((html.match(/<polygon/g) || []).length, 2);
    assert.doesNotMatch(html, /<script|<image|<foreignObject|kg-missing|NaN|Infinity/);
  }
});
test('invalid endpoint IDs, duplicate nested IDs and malformed geometry are reported, never dropped', () => {
  const cases: [string, (p: any) => void][] = [
    ['boundary-endpoint', p => { p.edges[0].to = 'ghost'; }],
    ['boundary-id', p => { p.cards[1].id = 'queue'; }],
    ['boundary-geometry', p => { p.cards[0].width = -2; }],
    ['boundary-geometry', p => { p.cards[0].x = Infinity; }],
    ['boundary-geometry', p => { p.edges[0].via = [[0, 'bad']]; }],
    ['boundary-geometry', p => { p.cards[0].children[0].width = 900; }],
    ['boundary-geometry', p => { p.cards[0].children = 0; }],
    ['boundary-geometry', p => { p.cards[0].rules = null; }],
    ['boundary-geometry', p => { p.edges[0].via = null; }],
  ];
  for (const [code, change] of cases) {
    const p = props(); change(p); const result = K.validate(doc(p));
    assert.equal(result.ok, false); assert.ok(result.errors.some((e: any) => e.code === code), JSON.stringify(result.errors));
    const html = renderToStaticMarkup(React.createElement(K.CoreBoundaryDiagram, p));
    assert.match(html, /role="alert"/); assert.doesNotMatch(html, /NaN|Infinity/);
  }
});

test('routes preserve nested parent offsets, every waypoint, line fonts and divider geometry', () => {
  const p: any = props(); p.cards[0].rules = [100]; p.cards[0].lines.push({text:'Prose section', y:105, font:'sans'});
  for (const [style, dash] of [['solid', undefined], ['dotted', '3 5'], ['dashed', '8 6']] as const) {
    p.edges[0].style = style;
    const html = renderToStaticMarkup(React.createElement(K.CoreBoundaryDiagram, p));
    const path = html.match(/<polyline[^>]+>/)![0];
    assert.match(path, /points="214,190 300,190 300,150 420,150"/);
    if (dash) assert.ok(path.includes(`stroke-dasharray="${dash}"`)); else assert.doesNotMatch(path, /stroke-dasharray/);
    assert.match(html, /<line[^>]+x1="20"[^>]+x2="180"[^>]+y1="100"[^>]+y2="100"/);
    assert.match(html, /class="kg-boundary__sans[^"]*">Prose section/);
    assert.match(html, /class="kg-boundary__mono[^"]*">&lt;script&gt;literal/);
  }
});
test('nested typos, orphan label positions and collapsed route segments are rejected', () => {
  const changes = [
    (p: any) => { p.cards[0].body = 'lost content'; },
    (p: any) => { p.cards[0].children[0].body = 'lost child'; },
    (p: any) => { p.cards[0].lines[0].content = 'lost line'; },
    (p: any) => { p.edges[0].lable = 'lost label'; },
    (p: any) => { delete p.edges[0].label; delete p.edges[0].labelY; },
    (p: any) => { delete p.edges[0].label; delete p.edges[0].labelX; },
    (p: any) => { p.edges[0].from='queue';p.edges[0].to='queue';p.edges[0].toSide='right';p.edges[0].via=[]; },
    (p: any) => { p.edges[0].via=[[214,190],[300,190],[300,150]]; },
    (p: any) => { p.edges[0].via=[[300,190],[300,150],[420,150]]; },
  ];
  for (const change of changes) {
    const p = props(); change(p); const v = K.validate(doc(p));
    assert.equal(v.ok, false, JSON.stringify(p));
    assert.ok(v.errors.some((e: any) => ['boundary-content','boundary-geometry'].includes(e.code)), JSON.stringify(v.errors));
    assert.match(renderToStaticMarkup(React.createElement(K.CoreBoundaryDiagram, p)), /role="alert"/);
  }
});
test('line emphasis is explicit and zones honour their outline style', () => {
  const p: any = props();p.zones[0].style='solid';p.cards[0].children[0].palette='amber';
  p.cards[0].children[0].lines.push({text:'Explicit emphasis',y:45,emphasis:'accent'});
  const html=renderToStaticMarkup(React.createElement(K.CoreBoundaryDiagram,p));
  assert.match(html,/class="kg-boundary__mono kg-boundary__line--accent">Explicit emphasis/);
  assert.doesNotMatch(html,/stroke-dasharray="8 7"/);
  const css=readFileSync('src/design-system/boundary.css','utf8');assert.doesNotMatch(css,/text:last-child/);
});
test('technical colours defer to pinned designs and text-bearing border tokens clear AA', () => {
  assert.match(boundaryCss(), /\.kg-kage:not\(\.kg-design\) \.kg-boundary/);
  for (const mode of ['light','dark'] as const) assert.ok(contrast(BOUNDARY_PALETTE[mode]['line-control'], BOUNDARY_PALETTE[mode].paper)>=4.5,mode);
});
test('the full library ships the neutral example and declares its nested schema and paint dependencies', () => {
  assert.ok(allExamples().some(d=>d.id==='system-boundary-example'));
  const c=K.contracts['core/boundary-diagram@1.0.0'];
  for(const token of ['wire','accent-soft','focus']) assert.ok(c.tokens.includes(token),token);
  assert.ok(c.props.cards.items.properties.lines.items.properties.emphasis);
  assert.ok(c.props.edges.items.properties.via.items.items);
});

test('opaque sibling and non-nested rectangles cannot overlap, while containing zones are exempt', () => {
  for (const change of [
    (p: any) => { p.cards.push({...p.cards[1],id:'covered-store'}); },
    (p: any) => { p.cards[0].children.push({...p.cards[0].children[0],id:'covered-row'}); },
    (p: any) => { p.cards[1].x=200;p.cards[1].width=300; },
  ]) {
    const p=props();change(p);const v=K.validate(doc(p));assert.equal(v.ok,false);
    assert.ok(v.errors.some((e:any)=>e.code==='boundary-overlap'),JSON.stringify(v.errors));
    assert.match(renderToStaticMarkup(React.createElement(K.CoreBoundaryDiagram,p)),/role="alert"/);
  }
  assert.equal(K.validate(doc()).ok,true,'zones may enclose cards and children');
});
test('empty drawings fail, zone-only drawings remain meaningful and explicit dashed zones match the default', () => {
  const p:any=props();p.cards=[];p.edges=[];p.zones=[];
  assert.equal(K.validate(doc(p)).ok,false);
  p.zones=props().zones;assert.equal(K.validate(doc(p)).ok,true);
  const base=renderToStaticMarkup(React.createElement(K.CoreBoundaryDiagram,props()));
  const explicit:any=props();explicit.zones[0].style='dashed';
  assert.equal(renderToStaticMarkup(React.createElement(K.CoreBoundaryDiagram,explicit)),base);
});

test('the global rectangle budget bounds overlap checking and reports excess instead of dropping it', () => {
 const p:any=props();p.width=2000;p.zones=[];p.edges=[];
 p.cards=Array.from({length:11},(_,i)=>({id:'group'+i,x:i*180,y:50,width:170,height:200,children:Array.from({length:200},(_,j)=>({id:'cell'+i+'-'+j,x:2+(j%40)*4,y:2+Math.floor(j/40)*4,width:1,height:1}))}));
 const v=K.validate(doc(p));assert.equal(v.ok,false);assert.ok(v.errors.some((e:any)=>e.code==='boundary-geometry'&&/2000/.test(e.msg)));
});
