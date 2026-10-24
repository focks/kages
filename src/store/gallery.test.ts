// Gallery opt-in must be atomic with public visibility. Votes are desired state
// changes and remain correct after persistence restores, retries and revocation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from './store.ts';
import { galleryPage } from './gallery.ts';
import { sampleKage } from '../test-support/fixtures.ts';
import { dispatch } from '../adapters/operations.ts';
const owner = { principal: 'user:owner' }, reader = { principal: 'user:reader' }, other = { principal: 'user:other' }, anon = { principal: 'anon' };
function fixture() {
 const store=new Store({workspace:'gallery-test',clock:()=>1700000000000});
 store.grant(owner.principal,'work',['read','write','publish','admin']);
 assert.ok(store.create('work',sampleKage({id:'one',title:'A useful chart'}),owner).ok);
 return {store,uuid:store.head('one')!.uuid};
}
const cards=(s:Store,who=reader)=>galleryPage(s.galleryEntries(),who);

test('gallery is explicit opt-in and publishes atomically with public visibility',()=>{
 const {store:s}=fixture();assert.equal(cards(s).total,0);
 assert.ok(s.publish('one',owner,'public').ok);assert.equal(cards(s).total,0,'ordinary public sharing does not opt in');
 assert.equal(s.publishToGallery('one',reader).ok,false);assert.equal(cards(s).total,0);
 assert.ok(s.publishToGallery('one',owner,1).ok);assert.equal(s.head('one')!.visibility,'public');
 assert.equal(cards(s,anon).total,1);assert.equal(cards(s,anon).canVote,false);
 assert.ok(s.publishToGallery('one',owner,1).ok,'republishing is idempotent');assert.equal(cards(s).total,1);
 assert.ok(s.removeFromGallery('one',owner).ok);assert.equal(cards(s).total,0);assert.equal(s.head('one')!.visibility,'public');
});

test('new drafts, narrowing visibility and lifecycle changes withdraw listings; ordinary sharing does not re-enroll',()=>{
 for(const change of ['private','link','unpublish','archive','deprecate','patch','delete']){
  const {store:s,uuid}=fixture();assert.ok(s.publishToGallery('one',owner).ok);
  assert.ok(s.voteGallery(uuid,reader,1).ok);
  if(change==='private'||change==='link')assert.ok(s.share('one',owner,change).ok);
  else if(change==='patch')assert.ok(s.patch('one',[{op:'replace',path:'/title',value:'Private revision'}],owner).ok);
  else if(change==='delete')assert.ok(s.remove('one',owner).ok);
  else assert.ok(s[change as 'unpublish'|'archive'|'deprecate']('one',owner).ok);
  assert.equal(cards(s).total,0,change);assert.equal(cards(Store.restore(s.snapshot())).total,0,change);
  assert.equal(s.voteGallery(uuid,other,1).ok,false,change);
  assert.ok((s.snapshot().gallery??[]).every(e=>e.card===null));
  if(change==='delete')assert.equal(s.snapshot().gallery,undefined);
  if(change==='private'){s.share('one',owner,'public');assert.equal(cards(s).total,0);s.publishToGallery('one',owner);assert.equal(cards(s).items[0].upvotes,1);}
 }
});

test('upvotes are unique, removable, durable, account-scoped and never expose the voter map',()=>{
 const {store:s,uuid}=fixture();s.publishToGallery('one',owner);
 assert.equal(s.voteGallery(uuid,anon,1).ok,false);assert.equal(s.voteGallery(uuid,{principal:'guest:x'},1).ok,false);
 assert.equal(s.voteGallery(uuid,reader,-1).ok,false);assert.equal(s.voteGallery(uuid,reader,2).ok,false);
 for(let i=0;i<3;i++)assert.ok(s.voteGallery(uuid,reader,1).ok);
 assert.ok(s.voteGallery(uuid,other,1).ok);assert.equal(cards(s).items[0].upvotes,2);assert.equal(cards(s).items[0].myVote,true);
 const restored=Store.restore(s.snapshot());assert.equal(cards(restored,anon).items[0].myVote,false);
 assert.ok(restored.voteGallery(uuid,reader,0).ok);assert.equal(cards(restored).items[0].upvotes,1);assert.equal(cards(restored).items[0].myVote,false);
 const serialized=JSON.stringify(cards(restored));assert.doesNotMatch(serialized,/user:reader|user:other|"votes"|"work"|gallery-test/);
 assert.ok(restored.removeFromGallery('one',owner).ok);assert.ok(restored.publishToGallery('one',owner).ok);assert.equal(cards(restored).items[0].upvotes,1);
});

test('legacy snapshots restore with an empty gallery and stale publish requests do not alter visibility',()=>{
 const {store:s}=fixture();const before=s.snapshot();assert.equal(before.gallery,undefined);
 assert.equal(s.publishToGallery('one',owner,2).ok,false);assert.deepEqual(s.snapshot(),before);
 assert.equal(cards(Store.restore(before)).total,0);
});

test('gallery operations validate votes and pagination; listing supports search, ranking and safe documents',()=>{
 const {store:s,uuid}=fixture();s.create('work',sampleKage({id:'two',title:'Second handbook'}),owner);
 const ctx={store:s,author:owner};assert.ok(dispatch(ctx,'publish_to_gallery',{name:'one'}).ok);assert.ok(dispatch(ctx,'publish_to_gallery',{name:'two'}).ok);
 assert.ok(dispatch({store:s,author:reader},'vote_gallery_kage',{uuid,value:1}).ok);
 const result=dispatch({store:s,author:anon},'list_gallery',{limit:1});assert.ok(result.ok);assert.equal((result.data as any).items[0].uuid,uuid);assert.equal((result.data as any).nextOffset,1);
 const search=dispatch(ctx,'list_gallery',{text:'handbook'});assert.ok(search.ok);assert.equal((search.data as any).total,1);
 for(const args of [{limit:0},{limit:1000},{offset:-1},{sort:'random'}])assert.equal(dispatch(ctx,'list_gallery',args).ok,false);
 assert.equal(dispatch(ctx,'vote_gallery_kage',{uuid,value:-1}).ok,false);
 assert.ok(dispatch({store:s,author:anon},'get_gallery_kage',{uuid,version:1}).ok);
 assert.equal(dispatch(ctx,'get_gallery_kage',{uuid,version:2}).ok,false);
 s.unpublish('one',owner);assert.equal(dispatch(ctx,'get_gallery_kage',{uuid}).ok,false);
});
