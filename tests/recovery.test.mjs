import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import app from '../dist/server/index.js';

test('password recovery, account isolation, expiry and session invalidation', async (t) => {
  const database=new DatabaseSync(':memory:');
  t.after(()=>database.close());
  const directory=new URL('../drizzle/',import.meta.url);
  for (const file of readdirSync(directory).sort()) database.exec(readFileSync(new URL(file,directory),'utf8'));
  const prepare=(query,parameters=[])=>({
    bind:(...values)=>prepare(query,values),
    run:async()=>({meta:database.prepare(query).run(...parameters)}),
    first:async()=>database.prepare(query).get(...parameters),
    all:async()=>({results:database.prepare(query).all(...parameters)})
  });
  const batch=async statements=>{
    database.exec('BEGIN');
    try{
      const results=[];
      for (const statement of statements) results.push(await statement.run());
      database.exec('COMMIT');
      return results;
    }catch(error){
      database.exec('ROLLBACK');
      throw error;
    }
  };
  const address='owner@example.test';
  const env={DB:{prepare,batch},TSU_AUTH_PEPPER:'test pepper',ADMIN_EMAIL:address,
    RESEND_API_KEY:'local-test',TSU_EMAIL_FROM:'noreply@example.test',TSU_PUBLIC_ORIGIN:'https://store.example.test'};
  const messages=[];
  t.mock.method(globalThis,'fetch',async(url,init)=>{
    assert.equal(url,'https://api.resend.com/emails');
    messages.push(JSON.parse(init.body));
    return Response.json({id:'mail-test'});
  });
  const origin='https://store.example.test';
  const owner={'oai-authenticated-user-id':'fixture-owner','oai-authenticated-user-email':address};
  const pending=[];
  const hit=async(path,data,identity={},cookie)=>{
    const headers={...identity,origin,'Content-Type':'application/json'};
    if (cookie) headers.cookie=cookie;
    const response=await app.fetch(new Request(origin+path,{method:data?'POST':'GET',headers,body:data?JSON.stringify(data):undefined}),
      env,{waitUntil:promise=>pending.push(promise)});
    while(pending.length) await pending.shift();
    return response;
  };
  const customer='/api/customer/';
  const admin='/api/account/';
  const token=()=>new URL(messages.at(-1).text.split('\n').at(-1)).hash.slice('#recovery='.length);
  const password='fixture password! very long';
  const changed='replacement fixture password';
  const identity={email:'client@example.test',password};
  const registered=await hit(customer+'register',identity);
  assert.equal(registered.status,200);
  const session=registered.headers.get('set-cookie').split(';')[0];
  for(let i=0;i<6;i++)assert.equal((await hit(customer+'login',{...identity,password:'incorrect password'})).status,401);
  assert.equal((await hit(customer+'login',identity)).status,429);
  const resetRequest=await hit(customer+'reset-request',{email:'unknown@example.test'});
  assert.equal(resetRequest.status,202);
  assert.equal(messages.length,0);
  assert.equal((await hit(customer+'reset-request',{email:identity.email,language:'en'})).status,202);
  assert.equal(messages.length,1);
  assert.ok(messages.at(-1).text.includes(origin+'/en/account#recovery='));
  const expired=token();
  assert.notEqual(database.prepare("SELECT token_hash FROM password_recovery WHERE scope='customer'").get().token_hash,expired);
  database.exec("UPDATE password_recovery SET expires_at=0");
  assert.equal((await hit(customer+'reset-password',{token:expired,password:changed})).status,400);
  assert.equal((await hit(customer+'reset-request',{email:identity.email})).status,202);
  assert.equal((await hit(customer+'reset-password',{token:expired,password:changed})).status,400);
  assert.equal((await hit(customer+'reset-password',{token:token(),password:changed})).status,200);
  assert.equal((await hit(customer+'reset-password',{token:token(),password:changed})).status,400);
  assert.equal((await (await hit(customer+'state',null,{},session)).json()).signedIn,false);
  assert.equal((await hit(customer+'login',identity)).status,401);
  assert.equal((await hit(customer+'login',{...identity,password:changed})).status,200);
  delete env.ADMIN_EMAIL;
  assert.equal((await hit(admin+'register',{email:address,password},owner)).status,503);
  env.ADMIN_EMAIL=address;
  const adminSignup=await hit(admin+'register',{email:address,password},owner);
  assert.equal(adminSignup.status,200);
  const adminSession=adminSignup.headers.get('set-cookie').split(';')[0];
  assert.equal((await hit(admin+'reset-request',{},owner)).status,200);
  const ownerToken=token();
  assert.equal((await hit(customer+'reset-password',{token:ownerToken,password:changed})).status,400);
  assert.equal((await hit(admin+'reset-password',{token:ownerToken,password:changed},{...owner,'oai-authenticated-user-id':'other'})).status,403);
  assert.equal((await hit(admin+'reset-password',{token:ownerToken,password:changed},owner)).status,200);
  assert.equal((await hit(admin+'reset-password',{token:ownerToken,password:changed},owner)).status,400);
  assert.equal((await (await hit(admin+'state',null,owner,adminSession)).json()).signedIn,false);
  assert.equal((await hit(admin+'login',{email:address,password:changed},owner)).status,200);
});
