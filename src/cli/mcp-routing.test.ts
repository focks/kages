// The actual child process must notice login/logout after initialize. A fake
// authenticated server keeps credentials and writes away from the user's account.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { writeFileSync, existsSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { tmpDir } from '../test-support/tmp.ts';
import { sampleKage } from '../test-support/fixtures.ts';
import { Store } from '../store/store.ts';
import { dispatch } from '../adapters/operations.ts';
import { mcpDestination } from './mcp-routing.ts';

test('MCP never silently converts unauthenticated cloud work into local writes',async()=>{
 assert.equal(mcpDestination(false,false),'setup');assert.equal(mcpDestination(true,true),'local');
 const config=tmpDir('mcp-login-'),workspace=tmpDir('mcp-workspace-'),store=new Store({workspace:'verified-cloud'});
 const server=createServer(async(req,res)=>{assert.equal(req.headers.authorization,'Bearer fixture-only');let raw='';for await(const x of req)raw+=x;const r=dispatch({store,author:{principal:'user:test'},connection:{mode:'cloud'}},req.url!.slice(5),JSON.parse(raw));res.writeHead(r.ok?200:400,{'content-type':'application/json'});res.end(JSON.stringify(r.ok?r.data:r));});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const port=(server.address() as {port:number}).port;
 const transport=new StdioClientTransport({command:process.execPath,args:[process.env.KAGES_TEST_CLI ?? join(process.cwd(),'bin/kages.mjs'),'mcp','-C',workspace],env:{...process.env,KAGES_CONFIG_HOME:config} as Record<string,string>,stderr:'pipe'});
 const client=new Client({name:'fresh-agent-test',version:'1'});
 try{await client.connect(transport);assert.match(client.getInstructions()!,/get_setup/);
 const call=async(name:string,args={})=>client.callTool({name,arguments:args});
 const read=async()=>JSON.parse(((await call('get_setup')).content as {text:string}[])[0].text);
 assert.equal((await read()).ready,false);
 assert.equal((await call('create_kage',{doc:sampleKage({id:'blocked'}),repo:'test'})).isError,true);
 assert.equal(existsSync(join(workspace,'store.json')),false);
 writeFileSync(join(config,'config.json'),JSON.stringify({apiUrl:`http://127.0.0.1:${port}`,session:{access_token:'fixture-only',refresh_token:'unused',expires_at:4102444800,email:'test@example.test'}}));
 assert.equal((await read()).workspace,'verified-cloud');
 assert.equal((await call('create_kage',{doc:sampleKage({id:'first-cloud-kage'}),repo:'test'})).isError,undefined);
 assert.ok(store.head('first-cloud-kage'));
 writeFileSync(join(config,'config.json'),'{}');
 assert.equal((await read()).ready,false);
 assert.equal((await call('create_kage',{doc:sampleKage({id:'after-logout'}),repo:'test'})).isError,true);
 assert.equal(existsSync(join(workspace,'store.json')),false);
 }finally{await client.close();await transport.close();await new Promise<void>(r=>server.close(()=>r()));}
});
