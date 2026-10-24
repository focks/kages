// A tool-only client must obtain real readiness and authoring guidance without
// selecting a prompt, reading private prose or altering the workspace.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../store/store.ts';
import { dispatch } from './operations.ts';
import { handleMcpMessage } from './mcp.ts';

test('setup distinguishes anonymous, cloud and local without treating a missing brief as a blocker', () => {
 const store=new Store({workspace:'personal'});const before=store.snapshot();
 const data=(principal:string,mode:'cloud'|'local'|'setup')=>{const r=dispatch({store,author:{principal},connection:{mode,origin:'https://example.test'}},'get_setup',{});assert.ok(r.ok);return r.data as any;};
 const anonymous=data('anon','cloud');assert.equal(anonymous.ready,false);assert.equal(anonymous.workspace,null);assert.match(anonymous.next.join(' '),/https:\/\/example.test/);
 const cloud=data('user:owner','cloud');assert.equal(cloud.ready,true);assert.equal(cloud.workspace,'personal');assert.equal(cloud.brief.requiredForCreation,false);
 assert.match(data('user:owner','local').publishing,/no hosted share URL/);
 assert.equal(data('user:owner','setup').ready,false);
 assert.deepEqual(store.snapshot(),before);
});

test('tool-only discovery supplies the skill, exact reference and example without filesystem traversal', async () => {
 const store=new Store({workspace:'test'});const exec=async(name:string,args:Record<string,unknown>)=>dispatch({store,author:{principal:'anon'}},name,args);
 const initialize:any=await handleMcpMessage(exec,{id:1,method:'initialize'});assert.match(initialize.result.instructions,/get_setup.*get_context/);
 const context:any=await handleMcpMessage(exec,{id:2,method:'tools/call',params:{name:'get_context',arguments:{system:'core'}}});
 const content=JSON.parse(context.result.content[0].text);assert.match(content.authoring.skill,/Design before choosing blocks/);assert.equal(content.setup.ready,false);
 for(const path of ['SKILL.md','reference/examples.md','reference/examples/evidence-workbench.kage.json']){
  const result:any=await exec('get_authoring_guide',{system:'core',path});assert.ok(result.ok);assert.ok(result.data.content.length>100);
 }
 for(const path of ['../../.env','__proto__','constructor','reference/../../config'])assert.equal((await exec('get_authoring_guide',{path})).ok,false);
 assert.equal((await exec('get_authoring_guide',{system:'__proto__'})).ok,false);
 const resource:any=await handleMcpMessage(exec,{id:3,method:'resources/read',params:{uri:'kages://skill/core'}});assert.match(resource.result.contents[0].text,/get_authoring_guide/);
});
