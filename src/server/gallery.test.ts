// The REST projection must paginate across workspaces, never fetch entire private
// snapshots, and never turn a storage outage into an apparently empty gallery.
// The write path speaks the rpc protocol (kages_load / kages_save / kages_public_head);
// this fake backend implements the same CAS + delta semantics as the SQL functions.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Store, type StoreSnapshot } from '../store/store.ts';
import type { VersionRecord } from '../store/types.ts';
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

type Kages={name:string;versions:VersionRecord[]}[];
type Backend={rev:number;meta:Record<string,unknown>;kages:Kages};
function backendOf(s:Store):Backend{const {kages,...meta}=s.snapshot() as StoreSnapshot&Record<string,unknown>;return {rev:1,meta,kages:structuredClone(kages) as Kages};}
// Mirrors kages_save: CAS on rev, then apply the per-kage deltas.
function applySave(stored:Backend,b:any):boolean{
 if(b.p_expected_rev!==stored.rev)return false;
 stored.rev++;stored.meta=b.p_meta;
 const map=new Map(stored.kages.map(k=>[k.name,k.versions]));
 if(b.p_replace){for(const n of [...map.keys()])if(!b.p_upserts.some((u:any)=>u.name===n))map.delete(n);}
 for(const n of b.p_deletions)map.delete(n);
 for(const u of b.p_upserts)map.set(u.name,[...(map.get(u.name)??[]).slice(0,u.base),...u.versions]);
 stored.kages=[...map.entries()].map(([name,versions])=>({name,versions}));
 return true;
}
function publicHead(stored:Backend,uuid:string){
 for(const k of stored.kages){const h=k.versions.at(-1);
  if(h?.uuid===uuid&&h.state==='published'&&(h.visibility==='link'||h.visibility==='public'))return {workspace:String(stored.meta.workspace),record:h};}
 return null;
}

test('REST gallery reads only the atomic projection and walks all pages of workspace results',async()=>{
 const a=fixture('first'),b=fixture('second'),offsets:number[]=[];
 globalThis.fetch=async(input,init)=>{
  const url=new URL(String(input));assert.equal(url.searchParams.get('select'),'gallery:meta->gallery');assert.equal(init?.cache,'no-store');assert.ok(init?.signal);assert.match(url.searchParams.get('meta')!,/listed/);
  const offset=Number(url.searchParams.get('offset'));offsets.push(offset);
  return Response.json(offset===0?[{gallery:a.snapshot().gallery}]:offset===1?[{gallery:b.snapshot().gallery}]:[]);
 };
 const page=galleryPage(await readGalleryEntries(),{principal:'anon'});assert.equal(page.total,2);assert.deepEqual(offsets,[0,1,2]);assert.doesNotMatch(JSON.stringify(page),/user:owner|"votes"|"name"/);
 globalThis.fetch=async()=>new Response(null,{status:503});await assert.rejects(readGalleryEntries(),/503/);
});

test('concurrent cross-workspace votes retry against committed state without losing votes',async()=>{
 const s=fixture('owner-space'),uuid=s.head('doc')!.uuid,stored=backendOf(s);let conflicts=0;
 globalThis.fetch=async(input,init)=>{
  const path=new URL(String(input)).pathname;const body=init?.body?JSON.parse(String(init.body)):{};
  if(path.endsWith('/rpc/kages_load')){assert.equal(body.p_ws,'owner-space');return Response.json(structuredClone(stored));}
  if(path.endsWith('/rpc/kages_save')){const ok=applySave(stored,body);if(!ok)conflicts++;return Response.json(ok);}
  if(path.endsWith('/rpc/kages_public_head'))return Response.json(publicHead(stored,body.p_uuid));
  throw new Error('unexpected call: '+path);
 };
 assert.equal(await galleryWorkspace(uuid),'owner-space');
 const vote=(principal:string)=>mutateStore('owner-space',store=>({result:dispatch({store,author:{principal}},'vote_gallery_kage',{uuid,value:1})}));
 const replies=await Promise.all([vote('user:a'),vote('user:b')]);assert.ok(replies.every(r=>r.ok));assert.ok(conflicts>0);
 const restored=Store.restore({...stored.meta,kages:structuredClone(stored.kages)} as StoreSnapshot);
 assert.equal(galleryPage(restored.galleryEntries(),owner).items[0].upvotes,2);
 await vote('user:a');assert.equal(galleryPage(Store.restore({...stored.meta,kages:structuredClone(stored.kages)} as StoreSnapshot).galleryEntries(),owner).items[0].upvotes,2);
 // The earlier lookup may succeed, but the owner can revoke before the vote commits.
 restored.unpublish('doc',owner);
 const {kages,...meta}=restored.snapshot() as StoreSnapshot&Record<string,unknown>;
 stored.meta=meta;stored.kages=structuredClone(kages) as Kages;stored.rev++;
 const rejected=await vote('user:c');assert.equal(rejected.ok,false);assert.equal((stored.meta.gallery as {card:unknown}[])[0].card,null);
});

test('failed CAS attempts never report a vote as saved',async()=>{
 const s=fixture('busy-space'),uuid=s.head('doc')!.uuid,stored=backendOf(s);
 globalThis.fetch=async(input,_init)=>{
  const path=new URL(String(input)).pathname;
  if(path.endsWith('/rpc/kages_load'))return Response.json(structuredClone(stored));
  return Response.json(false); // every save loses its CAS
 };
 const result=await mutateStore('busy-space',store=>({result:dispatch({store,author:{principal:'user:voter'}},'vote_gallery_kage',{uuid,value:1})}));
 assert.equal(result.ok,false);if(!result.ok)assert.equal(result.error.code,'conflict');assert.equal(galleryPage(s.galleryEntries(),owner).items[0].upvotes,0);
});
