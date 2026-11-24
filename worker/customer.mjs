const customerCookie = '__Host-tsu_customer';
const customerLifetime = 14*24*60*60;
const emailPattern = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

function customerCookieToken(request) {
  const value = (request.headers.get('cookie') ?? '').split(';').map(x=>x.trim())
    .find(x=>x.startsWith(customerCookie+'='))?.slice(customerCookie.length+1);
  return /^[a-f0-9]{64}$/.test(value ?? '') ? value : null;
}

async function customerSession(request, env) {
  const token = customerCookieToken(request);
  if (!token) return null;
  return env.DB.prepare(
    'SELECT c.id, c.email, c.verified_at, c.newsletter_at FROM customers c JOIN customer_sessions s ON s.customer_id=c.id WHERE s.token_hash=? AND s.expires_at>?'
  ).bind(await sha256(token),epoch()).first();
}

function customerResponse(token, seconds) {
  const response = json({ok:true});
  response.headers.set('Set-Cookie',customerCookie+'='+token+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age='+seconds);
  return response;
}

async function newCustomerSession(request, env, customerId, verifiedHash) {
  const token = randomHex(32);
  const former = customerCookieToken(request);
  const now = epoch();
  const statements = [env.DB.prepare('DELETE FROM customer_sessions WHERE expires_at<=?').bind(now)];
  if (former) statements.push(env.DB.prepare('DELETE FROM customer_sessions WHERE token_hash=?').bind(await sha256(former)));
  statements.push(env.DB.prepare('INSERT INTO customer_sessions SELECT ?,id,? FROM customers WHERE id=? AND password_hash=?').bind(await sha256(token),now+customerLifetime,customerId,verifiedHash));
  const results=await env.DB.batch(statements);
  if (!results.at(-1).meta.changes) fail('Reconnecte-toi avec ton nouveau mot de passe.',401);
  return customerResponse(token,customerLifetime);
}

async function customerLimit(env, scope, value, limit, duration = 900) {
  const now = epoch();
  const id = await sha256(scope+'\n'+value);
  const attempt = await env.DB.prepare(`INSERT INTO customer_attempts VALUES (?,1,?)
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END,
    expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END
    WHERE expires_at<=? OR count<? RETURNING count`).bind(id,now+duration,now,now,now,limit).first();
  if (!attempt) fail('Trop de tentatives. Réessaie dans quelques minutes.',429);
  if (attempt.count === 1) await env.DB.prepare('DELETE FROM customer_attempts WHERE expires_at<=?').bind(now).run();
}

const customerEmailReady = env => Boolean(env.RESEND_API_KEY && env.TSU_EMAIL_FROM);

async function sendVerification(request, env, customer) {
  if (!customerEmailReady(env)) fail('La confirmation par e-mail est momentanément indisponible.',503);
  if (customer.verified_at) return json({ok:true});
  await customerLimit(env,'verify',customer.id,3,3600);
  const token = randomHex(32);
  const hash = await sha256(token);
  await env.DB.prepare(`INSERT INTO customer_email_tokens VALUES (?,?,?)
    ON CONFLICT(customer_id) DO UPDATE SET token_hash=excluded.token_hash,expires_at=excluded.expires_at`)
    .bind(hash,customer.id,epoch()+3600).run();
  const url = new URL(request.url).origin+'/espace-client#verification='+token;
  await provider('https://api.resend.com/emails',{
    method:'POST',redirect:'manual',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({from:env.TSU_EMAIL_FROM,to:[customer.email],subject:'Confirme ton adresse TSŪ / Verify your TSŪ email',
      text:'Confirme ton adresse TSŪ avec ce lien (valable une heure).\nVerify your TSŪ email with this link (valid for one hour).\n\n'+url})
  },'Le service e-mail');
  return json({ok:true});
}

async function customerAuthentication(request, env, action) {
  if (!env.TSU_AUTH_PEPPER) fail('La connexion client est momentanément indisponible.',503);
  const input = await body(request,4096);
  const email = normalizedEmail(input.email);
  const password = input.password;
  if (!emailPattern.test(email) || email.length>254 || typeof password!=='string' || password.length>128 ||
      password.length<(action==='register'?15:1)) fail('Adresse invalide ou mot de passe trop court (15 caractères à l’inscription).');
  const ip = request.headers.get('cf-connecting-ip') ?? 'local';
  await customerLimit(env,action+'-ip',ip,action==='register'?10:35);
  await customerLimit(env,action+'-email',email,6);
  if (action==='register') {
    const id = crypto.randomUUID();
    const salt = randomHex(16);
    const hash = await passwordHash('client:'+password,salt,env.TSU_AUTH_PEPPER);
    const result = await env.DB.prepare('INSERT INTO customers (id,email,salt,password_hash) VALUES (?,?,?,?) ON CONFLICT(email) DO NOTHING')
      .bind(id,email,salt,hash).run();
    if (!result.meta.changes) fail('Ce compte existe déjà. Connecte-toi.',409);
    return newCustomerSession(request,env,id,hash);
  }
  const customer = await env.DB.prepare('SELECT id,salt,password_hash FROM customers WHERE email=?').bind(email).first();
  const hash = await passwordHash('client:'+password,customer?.salt ?? '00000000000000000000000000000000',env.TSU_AUTH_PEPPER);
  if (!customer || !equalHash(hash,customer.password_hash)) fail('Adresse e-mail ou mot de passe invalide.',401);
  await env.DB.prepare('DELETE FROM customer_attempts WHERE key=?').bind(await sha256('login-email\n'+email)).run();
  return newCustomerSession(request,env,customer.id,hash);
}

function customerOrder(row) {
  const order = JSON.parse(row.data);
  return {id:order.id,createdAt:row.created_at,mode:order.mode ?? 'test',payment:order.payment,status:order.printful,
    total:(order.shippingFee ?? 0)+order.items.reduce((sum,item)=>sum+item.price*item.quantity,0),
    items:order.items.map(({name,quantity})=>({name,quantity})),
    shipments:(order.shipments ?? []).map(({number,url})=>({number,url:safePhoto(url)}))};
}

async function clientOrderRow(env, customerId, id) {
  if (typeof id!=='string' || !idPattern.test(id)) fail('Commande introuvable.',404);
  const row = await env.DB.prepare('SELECT id,created_at,session_id,data FROM shop_orders WHERE id=? AND customer_id=?').bind(id,customerId).first();
  if (!row) fail('Commande introuvable.',404);
  return row;
}

const newsletterAccess = (customer, env) => Boolean(customer?.newsletter_at && (customer.verified_at || (!salesEnabled(env) && !customerEmailReady(env))));

function canViewProduct(product, member) {
  if (!product.published) return false;
  if (product.audience==='newsletter') return member;
  if (product.audience==='early' && Date.parse(product.releaseAt)>Date.now()) return member;
  return true;
}

async function customerRecovery(request,env,action,ctx) {
  const input=await body(request,4096);
  const en=input.language==='en';
  if (action==='reset-password') return resetCredential(request,env,'customer',input);
  if (!customerEmailReady(env)) fail(en?'Password recovery email is temporarily unavailable.':'L’envoi du lien de récupération est momentanément indisponible.',503);
  const email=normalizedEmail(input.email);
  if (!emailPattern.test(email) || email.length>254) fail(en?'Enter a valid email address.':'Renseigne une adresse e-mail valide.');
  await customerLimit(env,'recovery-ip',request.headers.get('cf-connecting-ip') || 'local',12,3600);
  await customerLimit(env,'recovery-email',email,3,3600);
  const deliver=async()=>{
    const customer=await env.DB.prepare('SELECT id FROM customers WHERE email=?').bind(email).first();
    if (customer) await sendRecovery(request,env,'customer',customer.id,email,en);
  };
  const delivery=deliver().catch(()=>{ console.error('TSŪ customer recovery email delivery failed'); });
  if (ctx?.waitUntil) ctx.waitUntil(delivery);
  else await delivery;
  return json({ok:true},202);
}

async function customerRoute(request, env, action, ctx) {
  if (request.method==='POST' && (action==='reset-request' || action==='reset-password')) return customerRecovery(request,env,action,ctx);
  if (request.method==='POST' && ['register','login'].includes(action)) return customerAuthentication(request,env,action);
  if (request.method==='POST' && action==='logout') {
    const token = customerCookieToken(request);
    if (token) await env.DB.prepare('DELETE FROM customer_sessions WHERE token_hash=?').bind(await sha256(token)).run();
    return customerResponse('',0);
  }
  const customer = await customerSession(request,env);
  if (request.method==='GET' && action==='state') {
    if (!customer) return json({signedIn:false});
    const result = await env.DB.prepare('SELECT created_at,data FROM shop_orders WHERE customer_id=? ORDER BY created_at DESC LIMIT 100').bind(customer.id).all();
    return json({signedIn:true,email:customer.email,newsletter:Boolean(customer.newsletter_at),verified:Boolean(customer.verified_at),
      emailReady:customerEmailReady(env),member:newsletterAccess(customer,env),orders:result.results.map(customerOrder),
      tickets:await customerTickets(env,customer.id)});
  }
  if (!customer) fail('Connecte-toi à ton espace client.',401);
  if (request.method!=='POST') fail('Méthode refusée.',405);
  if (action==='send-verification') return sendVerification(request,env,customer);
  const input = await body(request,18000);
  if (action==='verify') {
    if (typeof input.token!=='string' || !/^[a-f0-9]{64}$/.test(input.token)) fail('Lien invalide ou expiré.');
    const hash = await sha256(input.token);
    const now = epoch();
    const result=await env.DB.batch([
      env.DB.prepare('UPDATE customers SET verified_at=? WHERE id=? AND EXISTS (SELECT 1 FROM customer_email_tokens WHERE token_hash=? AND customer_id=? AND expires_at>?)')
        .bind(now,customer.id,hash,customer.id,now),
      env.DB.prepare('DELETE FROM customer_email_tokens WHERE customer_id=? AND token_hash=?').bind(customer.id,hash)
    ]);
    if (!result[0].meta.changes) fail('Lien invalide ou expiré.');
    return json({ok:true});
  }
  if (action==='newsletter') {
    if (typeof input.enabled!=='boolean') fail('Choix invalide.');
    await env.DB.prepare('UPDATE customers SET newsletter_at=CASE WHEN ? THEN COALESCE(newsletter_at,?) ELSE NULL END WHERE id=?')
      .bind(Number(input.enabled),epoch(),customer.id).run();
    return json({ok:true});
  }
  if (action==='tracking') {
    const row = await clientOrderRow(env,customer.id,input.id);
    await customerLimit(env,'tracking',customer.id,20);
    const order = await reconcileOrder(env,row);
    return json(customerOrder({...row,data:JSON.stringify(order)}));
  }
  if (action==='tickets/new') return createCustomerTicket(env,customer,input);
  if (action==='tickets/reply') return replyToTicket(env,input,customer);
  fail('Action inconnue.',404);
}
