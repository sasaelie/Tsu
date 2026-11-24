// Public declarations are accepted independently of customer sessions or fulfillment status.
const withdrawalPaths = {fr:'/retractation', en:'/en/withdraw'};
const withdrawalLabels = {
  fr:{title:'Se rétracter ici', intro:'Tu peux exercer ton droit de rétractation pour tout ou partie de ta commande. Ton achat peut avoir été effectué sans compte.',name:'Nom et prénom',order:'Référence de commande',email:'Adresse e-mail où recevoir l’accusé',items:'Articles concernés',hint:'Indique « Toute la commande » ou les articles et quantités concernés.',review:'Vérifier ma déclaration',confirm:'Confirmer la rétractation',back:'Modifier ma déclaration',statement:'Je déclare exercer mon droit de rétractation pour les articles indiqués ci-dessous.',receipt:'Accusé de réception de rétractation',reference:'Référence de la déclaration',time:'Reçue le',download:'Télécharger mon accusé de réception',sent:'L’accusé a été transmis au service e-mail.',pending:'Ta déclaration est enregistrée. L’envoi par e-mail reste en attente. Télécharge ton accusé ci-dessous.',invalid:'Vérifie les quatre champs avant de continuer.',home:'Retour à la boutique',shipping:'Livraison et retours'},
  en:{title:'Withdraw from your contract here',intro:'You can exercise your right to withdraw from all or part of your order, including a guest purchase.',name:'Full name',order:'Order reference',email:'Email address for your acknowledgement',items:'Items concerned',hint:'Enter “Entire order” or list the items and quantities.',review:'Review my declaration',confirm:'Confirm withdrawal',back:'Edit my declaration',statement:'I hereby exercise my right to withdraw from the contract for the items listed below.',receipt:'Acknowledgement of withdrawal',reference:'Declaration reference',time:'Received on',download:'Download my acknowledgement',sent:'Your acknowledgement has been submitted to the email service.',pending:'Your declaration has been recorded. Email delivery is pending. Download your acknowledgement below.',invalid:'Please check all four fields before continuing.',home:'Back to shop',shipping:'Shipping and returns'}
};

function withdrawalPage(lang,title,content,status=200) {
  const labels=withdrawalLabels[lang];
  const shop=lang==='en'?'/en':'/';
  return new Response('<!doctype html><html lang="'+lang+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>'+htmlEscape(title)+' | TSŪ</title><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/customer/style.css"></head><body><header><a class="brand" href="'+shop+'">TSŪ</a><a href="'+shop+'">'+labels.home+'</a></header><main class="shop-section info-page client"><h1>'+htmlEscape(title)+'</h1>'+content+'</main></body></html>',{
    status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}
  });
}

const withdrawalHidden=(name,value)=>'<input type="hidden" name="'+name+'" value="'+htmlEscape(value)+'">';
const withdrawalFields=['customer_name','order_ref','email','items'];
const withdrawalKeys=['name','order','email','items'];
function withdrawalInputs(lang,data={}) {
  const words=withdrawalLabels[lang];
  const maxlengths=[140,100,254,900];
  const inputs=withdrawalFields.map((name,i)=>{
    const value=htmlEscape(data[name]||'');
    const control=name==='items'
      ? '<textarea name="items" required maxlength="900" rows="3" aria-describedby="item-help">'+value+'</textarea>'
      : '<input required type="'+(name==='email'?'email':'text')+'" name="'+name+'" maxlength="'+maxlengths[i]+'" value="'+value+'"'+(name==='email'?' autocomplete="email"':name==='customer_name'?' autocomplete="name"':'')+'>';
    return '<p><label>'+words[withdrawalKeys[i]]+'<br>'+control+'</label></p>';
  }).join('');
  return '<p>'+words.intro+'</p><p><a href="'+(lang==='en'?'/en/shipping-and-returns':'/livraison-retours')+'">'+words.shipping+'</a></p><form class="client-form" method="post">'+inputs+'<p id="item-help">'+words.hint+'</p><button class="primary" name="step" value="review">'+words.review+'</button></form>';
}

function withdrawalSummary(lang,data) {
  const w=withdrawalLabels[lang];
  return '<p>'+w.statement+'</p><dl>'+withdrawalFields.map((key,i)=>'<dt>'+w[withdrawalKeys[i]]+'</dt><dd class="preserve-lines">'+htmlEscape(data[key])+'</dd>').join('')+'</dl>';
}

function withdrawalReceipt(row) {
  const w=withdrawalLabels[row.lang];
  const received=new Intl.DateTimeFormat(row.lang==='en'?'en-GB':'fr-BE',{dateStyle:'long',timeStyle:'long',timeZone:'Europe/Brussels'}).format(new Date(row.received_at*1000));
  return [w.receipt+' — TSŪ',w.reference+' : '+row.id,w.time+' : '+received,'',w.statement,
    ...withdrawalFields.map((key,i)=>w[withdrawalKeys[i]]+' : '+row[key])].join('\n');
}

async function acknowledgeWithdrawal(env,row) {
  if (row.acknowledged_at) return true;
  if (!customerEmailReady(env)) return false;
  try {
    await env.DB.prepare('UPDATE withdrawals SET attempted_at=? WHERE id=?').bind(epoch(),row.id).run();
    await provider('https://api.resend.com/emails',{method:'POST',redirect:'manual',headers:{
      Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'tsu-withdrawal-'+row.id
    },body:JSON.stringify({from:env.TSU_EMAIL_FROM,to:[row.email],subject:withdrawalLabels[row.lang].receipt+' · TSŪ',text:withdrawalReceipt(row)})},'Le service e-mail');
    await env.DB.prepare('UPDATE withdrawals SET acknowledged_at=COALESCE(acknowledged_at,?) WHERE id=?').bind(epoch(),row.id).run();
    return true;
  } catch {return false;}
}

async function retryWithdrawalReceipts(env,limit=5) {
  if (!customerEmailReady(env)) return {sent:0,pending:true};
  const {results}=await env.DB.prepare('SELECT * FROM withdrawals WHERE acknowledged_at IS NULL ORDER BY COALESCE(attempted_at,0),received_at,id LIMIT ?').bind(limit).all();
  let sent=0;
  for (const row of results) {
    if (await acknowledgeWithdrawal(env,row)) sent++;
  }
  return {sent,attempted:results.length};
}

async function withdrawalForm(request) {
  const header=request.headers.get('content-type')?.split(';')[0];
  if (header!=='application/x-www-form-urlencoded') fail('Format de formulaire requis.',415);
  return new URLSearchParams(new TextDecoder().decode(await limitedBody(request,24000)));
}

async function withdrawalRoute(request,env,path) {
  if (path==='/admin/retractations') return withdrawalAdmin(request,env);
  const lang=path===withdrawalPaths.en?'en':'fr';
  const w=withdrawalLabels[lang];
  if (request.method==='GET') {
    const customer=await customerSession(request,env);
    const reference=new URL(request.url).searchParams.get('commande') || '';
    return withdrawalPage(lang,w.title,withdrawalInputs(lang,{
      email:customer?.email ?? '', order_ref:idPattern.test(reference)?reference:''
    }));
  }
  if (request.method!=='POST') fail('Méthode refusée.',405);
  const fields=await withdrawalForm(request);
  const data=Object.fromEntries(withdrawalFields.map(key=>[key,(fields.get(key)||'').trim()]));
  data.email=normalizedEmail(data.email);
  const step=fields.get('step');
  const valid=data.customer_name && data.customer_name.length<=140 && data.order_ref && data.order_ref.length<=100 &&
    emailPattern.test(data.email) && data.email.length<=254 && data.items && data.items.length<=900;
  if (step==='edit' || !valid) return withdrawalPage(lang,w.title,(!valid?'<p role="alert">'+w.invalid+'</p>':'')+withdrawalInputs(lang,data),valid?200:400);
  if (step==='review') {
    const hidden=withdrawalFields.map(key=>withdrawalHidden(key,data[key])).join('')+withdrawalHidden('id',crypto.randomUUID());
    return withdrawalPage(lang,w.review,withdrawalSummary(lang,data)+'<form method="post">'+hidden+'<button name="step" value="edit">'+w.back+'</button> <button class="primary" name="step" value="confirm">'+w.confirm+'</button></form>');
  }
  const id=fields.get('id');
  if (step!=='confirm' || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(id||'')) fail('Déclaration invalide.');
  let row=await env.DB.prepare('SELECT * FROM withdrawals WHERE id=?').bind(id).first();
  if (!row) {
    await customerLimit(env,'withdrawal-ip',request.headers.get('cf-connecting-ip')||'local',30,3600);
    await customerLimit(env,'withdrawal-email',data.email,8,3600);
    await env.DB.prepare('INSERT INTO withdrawals(id,order_ref,customer_name,email,items,lang,received_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING')
      .bind(id,data.order_ref,data.customer_name,data.email,data.items,lang,epoch()).run();
    row=await env.DB.prepare('SELECT * FROM withdrawals WHERE id=?').bind(id).first();
  }
  if (row.lang!==lang || withdrawalFields.some(key=>row[key]!==data[key])) fail('Déclaration invalide.',409);
  const sent=await acknowledgeWithdrawal(env,row);
  const receipt=withdrawalReceipt(row);
  const download='data:text/plain;charset=utf-8,'+encodeURIComponent(receipt);
  return withdrawalPage(lang,w.receipt,'<p role="status">'+(sent?w.sent:w.pending)+'</p><p class="preserve-lines">'+htmlEscape(receipt)+'</p><p><a class="primary" download="TSU-'+id+'.txt" href="'+htmlEscape(download)+'">'+w.download+'</a></p>');
}

async function withdrawalAdmin(request,env) {
  let message='';
  if (request.method==='POST') {
    const form=await withdrawalForm(request);
    const row=await env.DB.prepare('SELECT * FROM withdrawals WHERE id=?').bind(form.get('id')||'').first();
    if (!row) fail('Déclaration introuvable.',404);
    message=await acknowledgeWithdrawal(env,row)?'Accusé transmis au service e-mail.':'Envoi en attente. Vérifie l’expéditeur e-mail.';
  } else if (request.method!=='GET') fail('Méthode refusée.',405);
  const url=new URL(request.url);
  const page=Math.min(100000,Math.max(1,Number.parseInt(url.searchParams.get('page'),10)||1));
  const {results}=await env.DB.prepare('SELECT * FROM withdrawals ORDER BY received_at DESC,id DESC LIMIT 26 OFFSET ?').bind((page-1)*25).all();
  const rows=results.slice(0,25).map(row=>'<details><summary>'+htmlEscape(row.order_ref)+' · '+htmlEscape(row.email)+'</summary><p class="preserve-lines">'+htmlEscape(withdrawalReceipt(row))+'</p>'+
    (row.acknowledged_at?'<p>Accusé transmis au service e-mail.</p>':'<form method="post">'+withdrawalHidden('id',row.id)+'<button>Réessayer l’envoi de l’accusé</button></form>')+'</details>').join('');
  const paging=(page>1?'<a href="?page='+(page-1)+'">Page précédente</a> ':'')+(results.length>25?'<a href="?page='+(page+1)+'">Page suivante</a>':'');
  return withdrawalPage('fr','Rétractations','<a href="/admin?tab=orders">Retour aux commandes</a><p role="status">'+htmlEscape(message)+'</p>'+(rows||'<p>Aucune déclaration.</p>')+paging);
}
