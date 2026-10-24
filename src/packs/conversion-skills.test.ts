// A workflow is useful only when every distribution retrieves the same recipe
// and its advertised tool example actually passes transport and engine checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conversionSkills } from './conversion-skills.ts';
import { generatePlugins } from '../plugin/generate.ts';
import { filesFor } from '../install/files.ts';
import { dispatch } from '../adapters/operations.ts';
import { handleMcpMessage } from '../adapters/mcp.ts';
import { Store } from '../store/store.ts';
import { validate } from '../engine/validate.ts';

test('conversion recipes are discoverable and identical through tools, prompts, resources and plugins',async()=>{
 const store=new Store({workspace:'test'}),exec=async(name:string,args:Record<string,unknown>)=>dispatch({store,author:{principal:'anon'}},name,args);
 const rpc=async(method:string,params?:any)=>(await handleMcpMessage(exec,{id:1,method,params}) as any).result;
 const prompts=await rpc('prompts/list'),resources=await rpc('resources/list');
 const context=await exec('get_context',{});assert.ok(context.ok);
 const skills=conversionSkills();assert.deepEqual(skills.map(s=>s.name),['kages-markdown-to-kage','kages-data-to-kage','kages-document-to-kage','kages-web-to-kage']);
 assert.deepEqual((context.data as any).authoring.conversionSkills.map((s:any)=>s.name),skills.map(s=>s.name));
 for(const s of skills){
  const tool=await exec('get_authoring_guide',{name:s.name});assert.ok(tool.ok);assert.equal((tool.data as any).content,s.markdown);
  assert.ok(prompts.prompts.some((p:any)=>p.name===s.name));
  assert.equal((await rpc('prompts/get',{name:s.name})).messages[0].content.text,s.markdown);
  const uri='kages://workflow/'+s.name;assert.ok(resources.resources.some((r:any)=>r.uri===uri));
  assert.equal((await rpc('resources/read',{uri})).contents[0].text,s.markdown);
  for(const t of generatePlugins().targets)assert.equal(t.files[`skills/${s.name}/SKILL.md`],s.markdown);
  for(const provider of ['claude','codex'] as const)for(const scope of ['project','global'] as const){
   const planned=filesFor(provider,scope,{project:'/project',home:'/user'}).files.find(f=>f.path.endsWith(`/skills/${s.name}/SKILL.md`));assert.ok(planned);assert.ok(planned.content.includes(s.description));
  }
 }
 assert.equal((await exec('get_authoring_guide',{name:'../../.env'})).ok,false);
});

test('the documented Markdown workflow converts through the real operation with supported toc options',()=>{
 const s=conversionSkills()[0];const example=JSON.parse(s.markdown.match(/```json\n([\s\S]+?)\n```/)![1]);
 const store=new Store({workspace:'test'});const before=store.snapshot();
 for(const toc of ['auto','always','never']){
  const r=dispatch({store,author:{principal:'anon'}},'outline_to_kage',{...example,toc});assert.ok(r.ok,JSON.stringify(r));
  const doc=(r.data as any).doc;assert.ok(validate(doc).ok);assert.ok(JSON.stringify(doc).includes('https://example.com/handbook'));
  assert.equal(Object.values(doc.blocks).some((b:any)=>b.type==='toc'),toc==='always');
 }
 assert.deepEqual(store.snapshot(),before,'conversion returns a draft without writing or publishing');
});
