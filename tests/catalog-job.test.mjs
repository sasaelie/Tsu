import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {test} from 'node:test';
import app from '../dist/server/index.js';

test('le catalogue en tâche de fond résiste aux reprises et conserve les publications manuelles',async t=>{
  const db=new DatabaseSync(':memory:');
  t.after(()=>db.close());
  const migrations=new URL('../drizzle/',import.meta.url);
  for(const migration of readdirSync(migrations).sort()) db.exec(readFileSync(new URL(migration,migrations),'utf8'));
  const prepare=(sql,args=[])=>({
    bind:(...values)=>prepare(sql,values),
    first:async()=>db.prepare(sql).get(...args),
    run:async()=>({meta:db.prepare(sql).run(...args)}),
    all:async()=>({results:db.prepare(sql).all(...args)})
  });
  const env={DB:{prepare},PRINTFUL_TOKEN:'test-fixture',TSU_CATALOG_CRON_SECRET:'x'.repeat(45)};
  const route='https://fixture.test/api/jobs/printful-catalog';
  const invoke=()=>app.fetch(new Request(route,{method:'POST',headers:{authorization:'Bearer '+env.TSU_CATALOG_CRON_SECRET}}),env);
  const product=(id)=>({id,name:'T-shirt '+id});
  const catalog=Array.from({length:9},(_,index)=>product(index+1));
  const past={id:'pf-1',name:'Ma description éditée',published:true,variants:[{syncId:1001}]};
  db.prepare('INSERT INTO products VALUES(?,?)').run(past.id,JSON.stringify(past));
  const receiptId='09bc1166-c290-4d97-9119-c9b245917fa5';
  db.prepare('INSERT INTO withdrawals (id,order_ref,customer_name,email,items,lang,received_at) VALUES(?,?,?,?,?,?,?)').run(
    receiptId,'test-order','Test','test@example.test','Toute la commande','fr',1
  );
  let sent=0;
  let pauseList,releaseList;
  const listing=new Promise(resolve=>{pauseList=resolve;});
  const resume=new Promise(resolve=>{releaseList=resolve;});
  let paused=false,detailFailed=true,listingFailed=false;
  t.mock.method(globalThis,'fetch',async (raw,{method,headers})=>{
    const url=new URL(raw);
    if (url.hostname==='api.resend.com') {
      assert.equal(method,'POST');
      assert.equal(headers['Idempotency-Key'],'tsu-withdrawal-'+receiptId);
      sent++;
      return Response.json({id:'test-message'});
    }
    assert.equal(method,'GET');
    assert.equal(url.hostname,'api.printful.com');
    if(url.pathname==='/store/products'){
      if(listingFailed) return new Response(null,{status:503});
      if(!paused){paused=true;pauseList();await resume;}
      const offset=Number(url.searchParams.get('offset'));
      return Response.json({result:catalog.slice(offset,offset+8),paging:{total:catalog.length}});
    }
    const id=Number(url.pathname.split('/').pop());
    if(detailFailed&&id===2)return new Response(null,{status:503});
    return Response.json({result:{sync_product:product(id),sync_variants:[{id:id+1000,synced:true,currency:'EUR',retail_price:'14.90'}]}});
  });
  assert.equal((await app.fetch(new Request(route),env)).status,401);
  const first=invoke();
  await listing;
  assert.equal((await invoke()).status,202);
  releaseList();
  const page1=await (await first).json();
  assert.equal(page1.next,8);
  assert.equal(page1.failed,1);
  assert.equal(page1.added,6);
  listingFailed=true;
  assert.equal((await invoke()).status,502);
  assert.equal(db.prepare('select next_offset from printful_catalog_job').get().next_offset,8);
  listingFailed=false;
  const page2=await (await invoke()).json();
  assert.equal(page2.cycleFailed,1);
  assert.equal(page2.completed,true);
  assert.equal(page2.state,'partial');
  detailFailed=false;
  Object.assign(env,{TSU_EMAIL_FROM:'test@example.test',RESEND_API_KEY:'fake'});
  assert.equal((await (await invoke()).json()).added,1);
  assert.equal((await (await invoke()).json()).cycleFailed,0);
  assert.equal(sent,1);
  assert.ok(db.prepare('SELECT acknowledged_at FROM withdrawals WHERE id=?').get(receiptId).acknowledged_at);
  assert.equal(db.prepare('SELECT count(*) AS n FROM products').get().n,9);
  assert.equal(db.prepare("SELECT count(*) AS n FROM products WHERE json_extract(data,'$.published')=0").get().n,8);
  assert.deepEqual(JSON.parse(db.prepare('SELECT data FROM products WHERE id=?').get(past.id).data),past);
});
