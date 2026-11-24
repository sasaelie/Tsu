import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import test from 'node:test';
import app from '../dist/server/index.js';

test('mesure Google, consentement, isolation test/réel et déduplication',async()=>{
const db=new DatabaseSync(':memory:');
for (const file of readdirSync('drizzle').sort()) db.exec(readFileSync('drizzle/'+file,'utf8'));
const wrap=(query,args=[])=>({bind:(...parameters)=>wrap(query,parameters),first:async()=>db.prepare(query).get(...args),all:async()=>({results:db.prepare(query).all(...args)}),run:async()=>({meta:db.prepare(query).run(...args)})});
const env={DB:{prepare:wrap},TSU_AUTH_PEPPER:'temporary-fixture-value'};
const origin='https://test.example';
const session='a'.repeat(64),cookie='__Host-tsu_session='+session;
db.prepare("insert into tsu_owner(id,subject,email,salt,password_hash) values (1,'tsu-owner','owner@example.test','salt','hash')").run();
db.prepare('insert into tsu_sessions values (?,?)').run(createHash('sha256').update(session).digest('hex'),Math.floor(Date.now()/1000)+3600);
async function hit(path,{identity='tsu-owner',data,cookie}={}) {
  const headers=identity?{'oai-authenticated-user-id':identity,'oai-authenticated-user-email':'owner@example.test'}:{};
  if(cookie) headers.cookie=cookie;
  if(data) Object.assign(headers,{'content-type':'application/json',origin});
  return app.fetch(new Request(origin+path,{headers,method:data?'POST':'GET',body:data?JSON.stringify(data):undefined}),env);
}
const configure={productionId:'G-LIVE9876',testId:'G-TEST9876',searchConsole:'verif-fixture-123456'};
assert.equal((await hit('/api/admin/analytics',{identity:null})).status,401);
assert.equal((await hit('/api/admin/analytics',{cookie,data:{...configure,testId:configure.productionId}})).status,400);
const htmlTag='<script async src="https://www.googletagmanager.com/gtag/js?id=G-TEST9876"></script><script>gtag("config","G-TEST9876");</script>';
const consoleTag='<meta content="verif-fixture-123456" name="google-site-verification">';
const saved=await hit('/api/admin/analytics',{cookie,data:{...configure,testId:htmlTag,searchConsole:consoleTag}});
assert.equal(saved.status,200);
assert.deepEqual(await saved.json(),configure);
assert.equal((await hit('/api/admin/analytics',{cookie,data:{...configure,testId:htmlTag.replace('gtag("config","G-TEST9876")','gtag("config","G-OTHER0000")')}})).status,400);
assert.match(await (await hit('/?analytics_test=1',{cookie})).text(),/Envoyer le signal de test/);
assert.doesNotMatch(await (await hit('/?analytics_test=1')).text(),/Envoyer le signal de test/);
const home=await (await hit('/')).text();
assert.match(home,/google-site-verification" content="verif-fixture-123456/);
assert.match(home,/"analytics":\{"id":"G-TEST9876","mode":"test","path":"\/"\}/);
assert.doesNotMatch(home,/G-LIVE9876|googletagmanager.com/);
assert.match(home,/id="analytics-consent"[^>]* hidden/);
assert.match((await (await hit('/robots.txt')).text()),/Disallow: \//);
assert.equal((await hit('/sitemap.xml')).status,200);
const order={id:'tsa-test-order',mode:'test',payment:'paid',printfulId:100,shippingFee:600,items:[{productId:'tee-demo',name:'T-shirt',price:2990,quantity:2,syncId:999}]};
const stripeSession='cs_test_'+('q'.repeat(45));
db.prepare('insert into shop_orders(id,session_id,data) values (?,?,?)').run(order.id,stripeSession,JSON.stringify(order));
const confirmation=await (await hit('/api/checkout/result',{data:{sessionId:stripeSession}})).json();
assert.equal(confirmation.payment,'paid');
assert.deepEqual(confirmation.analytics,{shipping:6,items:[{item_id:'tee-demo',item_name:'T-shirt',price:29.9,quantity:2}]});
assert.doesNotMatch(JSON.stringify(confirmation),/cs_test|stripeSession/);
const {setupAnalytics}=await import(process.cwd()+'/dist/analytics.js');
const nodes=new Map();
const get=id=>{if(!nodes.has(id)) nodes.set(id,{hidden:true,focus(){}});return nodes.get(id);};
function storage(){const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};}
const scripts=[];
globalThis.localStorage=storage();
globalThis.sessionStorage=storage();
globalThis.window={};
globalThis.location={origin,hostname:'test.example'};
globalThis.document={documentElement:{lang:'fr'},cookie:'',referrer:'https://checkout.stripe.com/?credential=secret',getElementById:get,
  createElement:()=>({}),head:{append:element=>scripts.push(element)}};
const metrics=setupAnalytics({id:'G-TEST9876',mode:'test',path:'/'});
metrics.track('add_to_cart');
assert.equal(scripts.length,0);
get('analytics-reject').onclick();
metrics.purchase(confirmation);
assert.equal(scripts.length,0);
get('analytics-settings').onclick();
get('analytics-accept').onclick();
assert.equal(scripts.length,1);
assert.match(scripts[0].src,/G-TEST9876$/);
metrics.track('add_to_cart',{value:29.9});
get('analytics-test-send').onclick();
metrics.purchase({...confirmation,mode:'live'});
metrics.purchase(confirmation);
metrics.purchase(confirmation);
const events=window.dataLayer.map(args=>Array.from(args)).filter(args=>args[0]==='event');
assert.deepEqual(events.map(e=>e[1]),['page_view','add_to_cart','tsu_test_signal','purchase']);
assert.equal(events[3][2].value,59.8);
assert.doesNotMatch(JSON.stringify(window.dataLayer),/credential|cs_test|secret/);
get('analytics-reject').onclick();
metrics.track('add_to_cart');
assert.equal(window['ga-disable-G-TEST9876'],true);
assert.equal(window.dataLayer.map(args=>Array.from(args)).filter(args=>args[0]==='event').length,4);


assert.match(get('analytics-test-status').textContent,/DebugView/);
});
