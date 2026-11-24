// Run after node worker/build.mjs, using Node with node:sqlite.
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {after,test} from 'node:test';
import app from '../dist/server/index.js';

const originalFetch=globalThis.fetch;
after(()=>{globalThis.fetch=originalFetch;});

function database() {
  const db=new DatabaseSync(':memory:');
  const directory=new URL('../drizzle/',import.meta.url);
  for (const migration of readdirSync(directory).sort()) db.exec(readFileSync(new URL(migration,directory),'utf8'));
  const prepare=(sql,args=[])=>({
    bind:(...values)=>prepare(sql,values),
    first:async()=>db.prepare(sql).get(...args),
    all:async()=>({results:db.prepare(sql).all(...args)}),
    run:async()=>({meta:db.prepare(sql).run(...args)})
  });
  return {db,DB:{prepare}};
}

async function scenario({mode='live',automatic=true,optIn=true,paid=true,dropConfirmation=false,concurrent=false,stopSales=false,holdCosts=false}={}) {
  const {db,DB}=database();
  const id=randomUUID();
  const sessionId='cs_'+mode+'_'+id.replaceAll('-','');
  const hook='whsec_'+'fixture'.repeat(5);
  const env={DB,TSU_CHECKOUT_MODE:stopSales?'test':mode,
    STRIPE_LIVE_KEY:'rk_live_'+'fixture'.repeat(5),STRIPE_TEST_KEY:'rk_test_'+'fixture'.repeat(5),
    STRIPE_LIVE_WEBHOOK_SECRET:hook,STRIPE_TEST_WEBHOOK_SECRET:hook,PRINTFUL_TOKEN:'fixture'};
  db.prepare('INSERT INTO fulfillment_settings VALUES(1,?)').run(Number(automatic));
  const order={id,mode,country:'BE',payment:'unpaid',printful:'none',items:[{name:'T-shirt',quantity:1,price:2990,syncId:1}],shippingFee:0};
  if (optIn!==null) order.autoFulfill=optIn;
  db.prepare('INSERT INTO shop_orders(id,session_id,data) VALUES(?,?,?)').run(id,sessionId,JSON.stringify(order));
  let creates=0,confirmations=0,status=null;
  let releaseCreate,announceCreate;
  const createStarted=new Promise(resolve=>{announceCreate=resolve;});
  const holdCreate=new Promise(resolve=>{releaseCreate=resolve;});
  const supplier=()=>Response.json({result:{id:15,status}});
  globalThis.fetch=async(input,options)=>{
    const url=new URL(input);
    if(url.hostname==='api.stripe.com') {
      assert.equal(url.pathname,'/v1/checkout/sessions/'+sessionId);
      return Response.json({client_reference_id:id,livemode:mode==='live',amount_total:2990,currency:'eur',
        automatic_tax:{status:'complete'},payment_status:paid?'paid':'unpaid',status:'complete',shipping_details:{
          name:'Client test',address:{line1:'Rue de test',postal_code:'4000',city:'Liège',country:'BE'}}});
    }
    assert.equal(url.hostname,'api.printful.com');
    if(url.pathname==='/orders/@'+id.replaceAll('-','')) return status?supplier():new Response(null,{status:404});
    if(url.pathname==='/orders'&&options.method==='POST'){
      assert.equal(url.searchParams.get('confirm'),'false');
      assert.equal(JSON.parse(options.body).external_id,id.replaceAll('-',''));
      creates++; announceCreate();
      if(concurrent)await holdCreate;
      status=holdCosts?'onhold':'draft'; return supplier();
    }
    if(url.pathname==='/orders/15/confirm'&&options.method==='POST'){
      assert.equal(status,'draft');
      confirmations++; status='pending';
      if(dropConfirmation&&confirmations===1)throw Error('Simulated lost provider response');
      return supplier();
    }
    if(url.pathname==='/orders/15'&&options.method==='GET')return supplier();
    throw Error('Unexpected provider call '+url.pathname);
  };
  const notify=()=>{
    const body=JSON.stringify({type:'checkout.session.completed',livemode:mode==='live',data:{object:{id:sessionId}}});
    const ts=Math.floor(Date.now()/1000);
    const signature=createHmac('sha256',hook).update(ts+'.'+body).digest('hex');
    const endpoint='/api/stripe/webhook'+(mode==='live'?'/live':'');
    return app.fetch(new Request('https://fixture.example'+endpoint,{method:'POST',body,headers:{'stripe-signature':'t='+ts+',v1='+signature}}),env);
  };
  try {
    const first=notify();
    if(concurrent) {
      await createStarted;
      const overlapping=await notify();
      assert.equal(overlapping.status,503);
      releaseCreate();
    }
    assert.equal((await first).status,dropConfirmation||holdCosts?503:200);
    if(holdCosts) status='draft';
    assert.equal((await notify()).status,200);
    const row=db.prepare('SELECT data FROM shop_orders WHERE id=?').get(id);
    return {creates,confirmations,saved:JSON.parse(row.data)};
  } finally {db.close();}
}

for(const [label,settings,expected] of [
  ['confirmation volontaire après paiement réel',{},1],
  ['coûts différés puis commande libérée par Printful',{holdCosts:true},1],
  ['notifications concurrentes et répétées',{concurrent:true},1],
  ['réponse de confirmation perdue puis relue par identifiant',{dropConfirmation:true},1],
  ['interrupteur désactivé',{automatic:false},0],
  ['achat antérieur à l’activation',{optIn:false},0],
  ['commande historique sans préférence',{optIn:null},0],
  ['mode test avec réglage actif',{mode:'test'},0],
  ['ventes réelles suspendues',{stopSales:true},0],
  ['paiement en attente',{paid:false},0],
]) {
  test(label,async()=>{
    const {creates,confirmations,saved}=await scenario(settings);
    assert.equal(creates,settings.paid===false?0:1);
    assert.equal(confirmations,expected);
    assert.equal(saved.printful,settings.paid===false?'none':expected?'pending':'draft');
  });
}
