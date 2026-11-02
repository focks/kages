// Golden outputs come from the compiled oracle before the pure port is tested.
// This also exercises qualified types, composition definitions and generation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validate } from './validate.ts';
import { toGenerated, fromGenerated } from './generate.ts';
const doc = JSON.parse(readFileSync('docs/examples/boundary-diagram.kage.json', 'utf8'));
const golden = JSON.parse(readFileSync('src/engine/__fixtures__/golden-boundary.json', 'utf8'));
test('boundary validation and generation match the captured oracle for all systems', () => {
  for (const [i, system] of ['core', 'ledger', 'atelier'].entries()) {
    assert.deepEqual(validate(doc, system), golden[i].validation);
    assert.deepEqual(toGenerated(doc, system), golden[i].envelope);
    assert.equal(validate(fromGenerated(toGenerated(doc, system), system), system).ok, true);
  }
});
test('pure validation rejects nonexistent children, duplicates and malformed geometry', () => {
  for (const change of [
    (p: any) => { p.edges[0].to = 'missing-child'; },
    (p: any) => { p.cards[0].children[0].id = p.cards[1].id; },
    (p: any) => { p.cards[0].width = -1; },
    (p: any) => { p.edges[0].via = [[NaN, 20]]; },
    (p: any) => { p.cards[0].body = 'misspelled field'; },
    (p: any) => { p.edges[0].lable = 'misspelled label'; },
    (p: any) => { p.edges[0].via = [[292,170.5]]; },
  ]) {
    const d = structuredClone(doc); change(d.blocks.architecture.props);
    d.blocks.architecture.type = 'core/boundary-diagram@1';
    const v = validate(d); assert.equal(v.ok, false); assert.ok(v.errors.some(e => e.code.startsWith('boundary-')));
  }
});

test('a boundary composition matches the captured oracle in every system and survives generation', () => {
  const composed={kages:'1.0',id:'composed-boundary',title:'Composed boundary',system:'core',root:'instance',blocks:{instance:{type:'composition',props:{name:'drawing'}}},compositions:{drawing:{inputs:{},root:doc.root,blocks:doc.blocks}}};
  const expected=JSON.parse(readFileSync('src/engine/__fixtures__/golden-boundary-composition.json','utf8'));
  for(const [i,system] of ['core','ledger','atelier'].entries()){
    assert.deepEqual(validate(composed,system),expected[i].validation);
    assert.deepEqual(toGenerated(composed,system),expected[i].envelope);
    assert.equal(validate(fromGenerated(toGenerated(composed,system),system),system).ok,true);
  }
});
test('pure validation reports overlapping cards and rejects a blank boundary canvas', () => {
  const d=structuredClone(doc),p=d.blocks.architecture.props;
  p.cards.push({...structuredClone(p.cards[1]),id:'overlap-copy'});
  assert.ok(validate(d).errors.some(e=>e.code==='boundary-overlap'));
  p.cards=[];p.zones=[];p.edges=[];assert.equal(validate(d).ok,false);
});
