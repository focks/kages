// The CLI must persist gallery membership and dispatch vote intent, not toggle
// it locally; the same one-vote rule applies after separate process invocations.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCli } from '../test-support/cli.ts';
import { tmpDir } from '../test-support/tmp.ts';
import { sampleKage } from '../test-support/fixtures.ts';
test('publish --gallery makes public; gallery commands persist counts and removal',async()=>{
 const dir=tmpDir('gallery-cli-'),file=join(dir,'one.kage.json');writeFileSync(file,JSON.stringify(sampleKage({id:'one'})));
 const run=(args:string[])=>runCli(['--local','-C',dir,...args]);
 assert.equal((await run(['create',file])).code,0);
 assert.equal((await run(['publish','--gallery','one','--visibility','private'])).code,1);
 assert.equal((await run(['publish','--gallery','one'])).code,0);
 let page=JSON.parse((await run(['gallery','--json'])).out);assert.equal(page.total,1);const uuid=page.items[0].uuid;
 for(let i=0;i<2;i++)assert.equal((await run(['gallery','upvote',uuid])).code,0);
 page=JSON.parse((await run(['gallery','list','--json'])).out);assert.equal(page.items[0].upvotes,1);
 assert.equal((await run(['gallery','unvote',uuid])).code,0);assert.equal(JSON.parse((await run(['gallery','--json'])).out).items[0].upvotes,0);
 assert.equal((await run(['gallery','remove','one'])).code,0);assert.equal(JSON.parse((await run(['gallery','--json'])).out).total,0);
 const cards=JSON.parse((await run(['ls','--json'])).out);assert.equal(cards.find((c:any)=>c.name==='one').visibility,'public');
});
