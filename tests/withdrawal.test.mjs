import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import app from '../dist/server/index.js';

test('guest can review, edit, confirm and download a withdrawal; owner can retry the acknowledgement', async context=>{
  const database=new DatabaseSync(':memory:');
  context.after(()=>database.close());
  const migrations=new URL('../drizzle/',import.meta.url);
  for(const file of readdirSync(migrations).sort()) database.exec(readFileSync(new URL(file,migrations),'utf8'));
  const wrap=(sql,args=[])=>({
    bind:(...values)=>wrap(sql,values),
    all:async()=>({results:database.prepare(sql).all(...args)}),
    run:async()=>({meta:database.prepare(sql).run(...args)}),
    first:async()=>database.prepare(sql).get(...args)
  });
  const env={DB:{prepare:wrap},TSU_AUTH_PEPPER:'withdrawal-test'};
  const origin='https://example.test';
  const receiptEmails=[];
  context.mock.method(globalThis,'fetch',async (url,options)=>{
    assert.equal(url,'https://api.resend.com/emails');
    receiptEmails.push(JSON.parse(options.body));
    return Response.json({id:'mock-email'});
  });
  const hit=(path,form,headers={})=>app.fetch(new Request(origin+path,{
    method:form?'POST':'GET',headers:{origin,...headers},body:form?new URLSearchParams(form):undefined
  }),env);
  const frenchPage=await hit('/retractation?commande=demo-1234');
  assert.equal(frenchPage.status,200);
  const csp=frenchPage.headers.get('content-security-policy');
  assert.match(csp,/script-src 'self'/);
  assert.match(csp,/form-action 'self'/);
  assert.doesNotMatch(csp.match(/script-src[^;]*/)[0],/unsafe-inline/);
  const formPage=await frenchPage.text();
  assert.doesNotMatch(formPage,/<script\b|\son(?:click|submit)=/i);
  assert.match(formPage,/name="order_ref"[^>]*value="demo-1234"/);
  assert.match(await (await hit('/en/withdraw')).text(),/Full name/);
  const fields={customer_name:'Test Client',order_ref:'TSU-101',email:'client@example.test',items:'Entire order'};
  const review=await (await hit('/en/withdraw',{...fields,step:'review'})).text();
  assert.match(review,/Confirm withdrawal/);
  assert.equal(database.prepare('select count(*) as n from withdrawals').get().n,0);
  const id=review.match(/name="id" value="([^"]+)"/)[1];
  assert.match(await (await hit('/en/withdraw',{...fields,id,step:'edit'})).text(),/client@example.test/);
  const confirm={...fields,id,step:'confirm'};
  assert.equal((await hit('/en/withdraw',confirm,{origin:'https://elsewhere.test'})).status,403);
  const receipt=await (await hit('/en/withdraw',confirm)).text();
  assert.match(receipt,/Email delivery is pending/);
  assert.match(receipt,new RegExp('download="TSU-'+id+'.txt"'));
  assert.match(decodeURIComponent(receipt.match(/href="data:text\/plain;charset=utf-8,([^"]+)"/)[1]),/Entire order/);
  assert.equal((await hit('/en/withdraw',confirm)).status,200);
  assert.equal(database.prepare('select count(*) as n from withdrawals').get().n,1);
  assert.equal((await hit('/en/withdraw',{...confirm,email:'other@example.test'})).status,409);
  assert.equal((await hit('/admin/retractations')).status,401);
  env.RESEND_API_KEY='test-only';
  env.TSU_EMAIL_FROM='TSU <test@example.test>';
  const token='a'.repeat(64);
  database.prepare("insert into tsu_owner(id,subject,email,salt,password_hash) values (1,'owner','owner@example.test','salt','hash')").run();
  database.prepare('insert into tsu_sessions values (?,?)').run(createHash('sha256').update(token).digest('hex'),Math.floor(Date.now()/1000)+3600);
  const owner={'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.test',cookie:'__Host-tsu_session='+token};
  assert.match(await (await hit('/admin/retractations',undefined,owner)).text(),/TSU-101/);
  assert.equal((await hit('/admin/retractations',{id},owner)).status,200);
  assert.equal(receiptEmails.length,1);
  assert.match(receiptEmails[0].text,/Entire order/);
  assert.deepEqual(receiptEmails[0].to,['client@example.test']);
  assert.equal((await hit('/en/withdraw',confirm)).status,200);
  assert.equal(receiptEmails.length,1);
});
