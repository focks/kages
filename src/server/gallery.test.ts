// The REST projection must paginate across workspaces, never fetch entire private
// snapshots, and never turn a storage outage into an apparently empty gallery.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../store/store.ts';
import { sampleKage } from '../test-support/fixtures.ts';
import { galleryPage } from '../store/gallery.ts';
import { readGalleryEntries, galleryWorkspace } from './gallery.ts';
import { mutateStore } from './store-instance.ts';
import { dispatch } from '../adapters/operations.ts';
const previous={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY,db:process.env.DATABASE_URL};
process.env.SUPABASE_URL='https://storage.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='test-only';delete process.env.DATABASE_URL;
const original=globalThis.fetch;
after(()=>{globalThis.fetch=original;for(const [key,value]of [['SUPABASE_URL',previous.url],['SUPABASE_SERVICE_ROLE_KEY',previous.key],['DATABASE_URL',previous.db]])if(value===undefined)delete process.env[key!];else process.env[key!]=value;});
const owner={principal:'user:owner'};
function fixture(workspace:string){const s=new Store({workspace});s.create('r',sampleKage({id:'doc',title:workspace}),owner);s.publishToGallery('doc',owner);return s;}

test('REST gallery reads only the atomic projection and walks all pages of workspace results',async()=>{
 const a=fixture('first'),b=fixture('second'),offsets:number[]=[];
 globalThis.fetch=async(input,init)=>{
  const url=new URL(String(input));assert.equal(url.searchParams.get('select'),'gallery:snapshot->gallery');assert.equal(init?.cache,'no-store');assert.ok(init?.signal);assert.match(url.searchParams.get('snapshot')!,/listed/);
  const offset=Number(url.searchParams.get('offset'));offsets.push(offset);
  return Response.json(offset===0?[{gallery:a.snapshot().gallery}]:offset===1?[{gallery:b.snapshot().gallery}]:[]);
 };
 const page=galleryPage(await readGalleryEntries(),{principal:'anon'});assert.equal(page.total,2);assert.deepEqual(offsets,[0,1,2]);assert.doesNotMatch(JSON.stringify(page),/user:owner|"votes"|"name"/);
 globalThis.fetch=async()=>new Response(null,{status:503});await assert.rejects(readGalleryEntries(),/503/);
});

test('concurrent cross-workspace votes retry against committed state without losing votes',async()=>{
 const s=fixture('owner-space'),uuid=s.head('doc')!.uuid;let stored={...s.snapshot(),_rev:1},conflicts=0;
 globalThis.fetch=async(input,init)=>{
  const url=new URL(String(input));assert.ok(url.pathname.endsWith('/kages_state'));
  if(init?.method==='PATCH'){
   const expected=url.searchParams.get('snapshot->>_rev');
   if(expected!==`eq.${stored._rev}`){conflicts++;return Response.json([]);}
   stored=JSON.parse(String(init.body)).snapshot;return Response.json([{snapshot:stored}]);
  }
  if(url.searchParams.has('id')){assert.equal(url.searchParams.get('id'),'eq.owner-space');return Response.json([{snapshot:structuredClone(stored)}]);}
  return Response.json([{id:'owner-space',snapshot:structuredClone(stored)}]);
 };
 assert.equal(await galleryWorkspace(uuid),'owner-space');
 const vote=(principal:string)=>mutateStore('owner-space',store=>({result:dispatch({store,author:{principal}},'vote_gallery_kage',{uuid,value:1})}));
 const replies=await Promise.all([vote('user:a'),vote('user:b')]);assert.ok(replies.every(r=>r.ok));assert.ok(conflicts>0);
 const restored=Store.restore(stored);assert.equal(galleryPage(restored.galleryEntries(),owner).items[0].upvotes,2);
 await vote('user:a');assert.equal(galleryPage(Store.restore(stored).galleryEntries(),owner).items[0].upvotes,2);
 // The earlier lookup may succeed, but the owner can revoke before the vote commits.
 restored.unpublish('doc',owner);stored={...restored.snapshot(),_rev:stored._rev+1};
 const rejected=await vote('user:c');assert.equal(rejected.ok,false);assert.equal(stored.gallery![0].card,null);
});

test('failed CAS attempts never report a vote as saved',async()=>{
 const s=fixture('busy-space'),uuid=s.head('doc')!.uuid;
 globalThis.fetch=async(_input,init)=>Response.json(init?.method==='PATCH'?[]:[{snapshot:{...s.snapshot(),_rev:1}}]);
 const result=await mutateStore('busy-space',store=>({result:dispatch({store,author:{principal:'user:voter'}},'vote_gallery_kage',{uuid,value:1})}));
 assert.equal(result.ok,false);if(!result.ok)assert.equal(result.error.code,'conflict');assert.equal(galleryPage(s.galleryEntries(),owner).items[0].upvotes,0);
});
