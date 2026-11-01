import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import net from 'node:net';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';
const cwd=path.dirname(fileURLToPath(import.meta.url));
async function freePort(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));return port;}
async function start(file,env){const child=spawn(process.execPath,[file],{cwd,env:{...process.env,...env},stdio:['ignore','pipe','pipe']});let log='';await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill();reject(new Error('Example startup timeout: '+log));},10000);child.stdout.on('data',b=>{log+=b;if(log.includes('http://')){clearTimeout(timer);resolve();}});child.stderr.on('data',b=>log+=b);child.once('exit',code=>{clearTimeout(timer);reject(new Error(`Example exited ${code}: ${log}`));});});return child;}
async function stop(child){if(!child||child.exitCode!==null)return;await new Promise(r=>{child.once('exit',r);child.kill('SIGTERM');});}
test('complete local HTTP flow: create, retry, forged return, signed confirmation, duplicate, polling and restart',async()=>{
  const merchantPort=await freePort(),mockPort=await freePort(),dir=mkdtempSync(path.join(tmpdir(),'nilepay-example-http-'));
  const app=`http://127.0.0.1:${merchantPort}`,mock=`http://127.0.0.1:${mockPort}`;
  const env={PORT:String(merchantPort),MOCK_PORT:String(mockPort),APP_URL:app,NILEPAY_API_URL:mock,NILEPAY_API_KEY:'demo_key',NILEPAY_WEBHOOK_SECRET:'demo_secret',DATABASE_FILE:path.join(dir,'test.sqlite'),ALLOW_LIVE_CHECKOUT:'false'};
  let server,gateway;
  const create=()=>fetch(app+'/orders/1042/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({senderHandle:'customer@instapay'})});
  try{
    gateway=await start('mock-gateway.mjs',env);server=await start('server.mjs',env);
    const created=await create();assert.equal(created.status,200);const first=await created.json();assert.ok(first.sessionId);
    assert.equal((await (await create()).json()).sessionId,first.sessionId);
    await fetch(app+'/return?status=CONFIRMED');assert.equal((await (await fetch(app+'/orders/1042')).json()).status,'PENDING');
    const invalid=await fetch(app+'/webhooks/nilepay',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(invalid.status,401);
    const changed=await fetch(app+'/orders/1042/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({senderHandle:'other@instapay'})});assert.equal(changed.status,409);
    // The mock POST sends a genuinely signed webhook and redirects only afterward.
    const confirm=()=>fetch(mock+'/confirm/'+first.sessionId,{method:'POST',redirect:'manual'});
    assert.equal((await confirm()).status,303);const paid=await (await fetch(app+'/orders/1042')).json();assert.equal(paid.status,'PAID');assert.ok(paid.license);
    assert.equal((await confirm()).status,303);assert.equal((await (await fetch(app+'/orders/1042/status')).json()).license,paid.license);
    await stop(server);server=await start('server.mjs',env);assert.equal((await (await fetch(app+'/orders/1042/status')).json()).license,paid.license);
    assert.equal((await (await create()).json()).sessionId,first.sessionId);
  }finally{await stop(server);await stop(gateway);rmSync(dir,{recursive:true,force:true});}
});
