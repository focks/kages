// The gallery and its votes share the owner's snapshot CAS, including when
// another workspace's reader votes. Exercise the actual JSONB backend as well
// as the hermetic REST tests; use a disposable KAGES_TEST_DATABASE_URL only.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../store/store.ts';
import { sampleKage } from '../test-support/fixtures.ts';
import { saveSnapshot, loadSnapshotRev } from './persistence.ts';
import { readGalleryEntries, galleryWorkspace } from './gallery.ts';
import { mutateStore } from './store-instance.ts';
import { dispatch } from '../adapters/operations.ts';
import { galleryPage } from '../store/gallery.ts';
import { pool, closePool } from './pg.ts';
const url=process.env.KAGES_TEST_DATABASE_URL,ws='gallery-pg-'+process.pid;
if(url)process.env.DATABASE_URL=url;
after(async()=>{if(url){await pool().query('delete from workspaces where id = $1',[ws]);await closePool();}});
test('JSONB gallery discovery and concurrent account votes survive reload and revoke immediately',{skip:!url},async()=>{
 const owner={principal:'user:publisher'},s=new Store({workspace:ws});s.create('r',sampleKage({id:'public-doc'}),owner);s.publishToGallery('public-doc',owner);await saveSnapshot(ws,s.snapshot());
 const uuid=s.head('public-doc')!.uuid;assert.equal(await galleryWorkspace(uuid),ws);
 const vote=(principal:string)=>mutateStore(ws,store=>({result:dispatch({store,author:{principal}},'vote_gallery_kage',{uuid,value:1})}));
 const results=await Promise.all([vote('user:alice'),vote('user:bob')]);assert.ok(results.every(r=>r.ok));
 const page=galleryPage(await readGalleryEntries(),{principal:'user:alice'});assert.equal(page.items.find(c=>c.uuid===uuid)!.upvotes,2);assert.equal(page.items.find(c=>c.uuid===uuid)!.myVote,true);
 const restored=Store.restore((await loadSnapshotRev(ws))!.snapshot);assert.equal(galleryPage(restored.galleryEntries(),owner).items[0].upvotes,2);
 assert.ok((await mutateStore(ws,store=>({result:dispatch({store,author:owner},'share_kage',{name:'public-doc',visibility:'private'})}))).ok);
 assert.equal(await galleryWorkspace(uuid),null);assert.equal(galleryPage(await readGalleryEntries(),owner).items.some(c=>c.uuid===uuid),false);
});
