const encoder = new TextEncoder();
const sessionLifetime = 8 * 60 * 60;
const cookieName = '__Host-tsu_session';
const normalizedEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const hex = bytes => Array.from(new Uint8Array(bytes), byte=>byte.toString(16).padStart(2,'0')).join('');
const randomHex = size => hex(crypto.getRandomValues(new Uint8Array(size)).buffer);
const sha256 = async value => hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
const epoch = () => Math.floor(Date.now()/1000);

async function passwordHash(password, salt, pepper) {
  const pepperKey = await crypto.subtle.importKey('raw',encoder.encode(pepper),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const peppered = await crypto.subtle.sign('HMAC',pepperKey,encoder.encode(password));
  const key = await crypto.subtle.importKey('raw',peppered,'PBKDF2',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({
    name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations:100000
  },key,256));
}

function equalHash(left, right) {
  let difference = left.length ^ right.length;
  for (let index = 0; index < left.length; index++) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function sessionToken(request) {
  const cookie = (request.headers.get('cookie') ?? '').split(';').map(value=>value.trim())
    .find(value=>value.startsWith(cookieName+'='));
  const value = cookie?.slice(cookieName.length+1);
  return /^[a-f0-9]{64}$/.test(value ?? '') ? value : null;
}

function setSessionCookie(response, token, lifetime) {
  response.headers.set('Set-Cookie',cookieName+'='+token+'; Path=/; Max-Age='+lifetime+'; Secure; HttpOnly; SameSite=Lax');
  return response;
}

async function ownerRecord(env) {
  return env.DB.prepare('SELECT * FROM tsu_owner WHERE id = 1').bind().first();
}

function matchesOwner(record, subject, email) {
  return Boolean(record && subject && email && record.subject === subject && normalizedEmail(record.email) === normalizedEmail(email));
}

async function ownerSession(request, env, subject) {
  const token = sessionToken(request);
  if (!subject || !token) return null;
  return env.DB.prepare(
    'SELECT tsu_owner.email FROM tsu_owner JOIN tsu_sessions ON tsu_sessions.token_hash = ? WHERE tsu_owner.id = 1 AND tsu_owner.subject = ? AND tsu_sessions.expires_at > ?'
  ).bind(await sha256(token),subject,epoch()).first();
}

async function startSession(request, env, verifiedHash) {
  const old = sessionToken(request);
  if (old) await env.DB.prepare('DELETE FROM tsu_sessions WHERE token_hash = ?').bind(await sha256(old)).run();
  await env.DB.prepare('DELETE FROM tsu_sessions WHERE expires_at <= ?').bind(epoch()).run();
  const token = randomHex(32);
  const inserted = await env.DB.prepare('INSERT INTO tsu_sessions (token_hash,expires_at) SELECT ?,? FROM tsu_owner WHERE id=1 AND password_hash=?')
    .bind(await sha256(token),epoch()+sessionLifetime,verifiedHash).run();
  if (!inserted.meta.changes) fail('Reconnecte-toi avec ton nouveau mot de passe.',401);
  return setSessionCookie(json({ok:true}),token,sessionLifetime);
}

function recoveryOrigin(request, env) {
  const origin = new URL(request.url);
  if (['localhost','127.0.0.1','[::1]'].includes(origin.hostname)) return origin.origin;
  const configured = new URL(env.TSU_PUBLIC_ORIGIN || 'https://tsu-otaku-shop.sandy-field-0353.chatgpt.site');
  if (configured.protocol !== 'https:' || configured.username || configured.password) fail('Adresse du site à configurer.',503);
  return configured.origin;
}

async function sendRecovery(request,env,scope,id,email,en) {
  const token = randomHex(32);
  const hash = await sha256(token);
  const path = scope==='owner' ? '/compte'+(en?'?lang=en':'') : en?'/en/account':'/espace-client';
  const link = recoveryOrigin(request,env)+path+'#recovery='+token;
  await env.DB.prepare('INSERT INTO password_recovery VALUES (?,?,?,?) ON CONFLICT(scope,account_id) DO UPDATE SET token_hash=excluded.token_hash,expires_at=excluded.expires_at')
    .bind(scope,id,hash,epoch()+1800).run();
  try {
    await provider('https://api.resend.com/emails',{
      method:'POST',redirect:'manual',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({from:env.TSU_EMAIL_FROM,to:[email],
        subject:en?'Reset your TSŪ password':'Réinitialise ton mot de passe TSŪ',
        text:(en?'Choose your new password using this link within 30 minutes. If you did not request this, ignore this email.':'Choisis ton nouveau mot de passe dans les 30 minutes avec ce lien. Si tu n’as pas demandé de changement, ignore cet e-mail.')+'\n\n'+link})
    },'Le service e-mail');
  } catch(error) {
    await env.DB.prepare('DELETE FROM password_recovery WHERE token_hash=?').bind(hash).run();
    throw error;
  }
}

async function resetCredential(request,env,scope,input,owner) {
  const en=input.language==='en';
  const invalid=()=>fail(en?'This link is invalid or has expired.':'Ce lien est invalide ou a expiré.');
  if (!env.TSU_AUTH_PEPPER) fail(en?'Password recovery is temporarily unavailable.':'La récupération est momentanément indisponible.',503);
  if (typeof input.token!=='string' || !/^[0-9a-f]{64}$/.test(input.token)) invalid();
  if (typeof input.password!=='string' || input.password.length<15 || input.password.length>128)
    fail(en?'Choose a password with 15 to 128 characters.':'Choisis un mot de passe de 15 à 128 caractères.');
  await customerLimit(env,'reset-submit-'+scope,request.headers.get('cf-connecting-ip') || 'local',30);
  const hash=await sha256(input.token);
  const found=await env.DB.prepare('SELECT account_id FROM password_recovery WHERE scope=? AND token_hash=? AND expires_at>?')
    .bind(scope,hash,epoch()).first();
  if (!found || (scope==='owner' && found.account_id!==owner.subject)) invalid();
  const salt=randomHex(16);
  const newHash=await passwordHash((scope==='customer'?'client:':'')+input.password,salt,env.TSU_AUTH_PEPPER);
  // Recheck the token atomically. The matching trigger invalidates sessions and consumes it.
  const tokenCheck='(SELECT account_id FROM password_recovery WHERE scope=? AND token_hash=? AND expires_at>?)';
  const update=scope==='owner'
    ? env.DB.prepare('UPDATE tsu_owner SET salt=?,password_hash=?,failed_attempts=0,retry_after=0 WHERE subject=? AND email=? AND subject='+tokenCheck)
        .bind(salt,newHash,owner.subject,owner.email,scope,hash,epoch())
    : env.DB.prepare('UPDATE customers SET salt=?,password_hash=? WHERE id='+tokenCheck)
        .bind(salt,newHash,scope,hash,epoch());
  let changed;
  if (scope==='customer') {
    const person=await env.DB.prepare('SELECT email FROM customers WHERE id=?').bind(found.account_id).first();
    if (!person) invalid();
    const loginLimitKey=await sha256('login-email\n'+person.email);
    const clearLimit=env.DB.prepare('DELETE FROM customer_attempts WHERE key=? AND EXISTS (SELECT 1 FROM password_recovery WHERE scope=? AND account_id=? AND token_hash=? AND expires_at>?)')
      .bind(loginLimitKey,scope,found.account_id,hash,epoch());
    [,changed]=await env.DB.batch([clearLimit,update]);
  } else {
    changed=await update.run();
  }
  if (!changed.meta.changes) invalid();
  return scope==='owner'?setSessionCookie(json({ok:true}),'',0):customerResponse('',0);
}

async function ownerRecovery(request,env,action,subject,email) {
  const record=await ownerRecord(env);
  if (!matchesOwner(record,subject,email)) fail('Accès propriétaire requis.',403);
  const input=await body(request,4096);
  if (action==='reset-password') return resetCredential(request,env,'owner',input,record);
  if (!customerEmailReady(env)) fail(input.language==='en'?'Password recovery email is temporarily unavailable.':'L’envoi du lien de récupération est momentanément indisponible.',503);
  await customerLimit(env,'owner-recovery',subject,3,3600);
  await sendRecovery(request,env,'owner',subject,email,input.language==='en');
  return json({ok:true});
}

async function accountRoute(request, env, action, subject, platformEmail) {
  if (!subject || !platformEmail) return json({error:'Ouvre la préproduction avec le compte ChatGPT propriétaire.'},401);
  const email = normalizedEmail(platformEmail);
  if (env.ADMIN_EMAIL && email !== normalizedEmail(env.ADMIN_EMAIL)) return json({error:'Accès propriétaire requis.'},403);
  if (action === 'state' && request.method === 'GET') {
    const record = await ownerRecord(env);
    if (record && !matchesOwner(record,subject,email)) return json({error:'Ouvre cette page avec le compte ChatGPT qui possède la boutique TSŪ.'},403);
    const account = await ownerSession(request,env,subject);
    return json({hasOwner:Boolean(record),signedIn:Boolean(account),email:account?.email ?? email});
  }
  if (request.method !== 'POST') return json({error:'Méthode refusée.'},405);
  if (action === 'logout') {
    const token = sessionToken(request);
    if (token) await env.DB.prepare('DELETE FROM tsu_sessions WHERE token_hash = ?').bind(await sha256(token)).run();
    return setSessionCookie(json({ok:true}),'',0);
  }
  if (action==='reset-request' || action==='reset-password') return ownerRecovery(request,env,action,subject,email);
  if (action !== 'register' && action !== 'login') return json({error:'Action inconnue.'},404);
  if (!env.TSU_AUTH_PEPPER) return json({error:'La connexion TSŪ est momentanément indisponible.'},503);
  const input = await body(request);
  const password = input?.password;
  if ((!/^[^\s@]+@[^\s@]+$/.test(email) || email.length > 254) ||
      typeof password !== 'string' || !password || password.length > 128 ||
      (action === 'login' && normalizedEmail(input?.email) !== email)) {
    return json({error:'Adresse e-mail ou mot de passe invalide.'},400);
  }
  const owner = await ownerRecord(env);
  if (action === 'register') {
    if (owner) return json({error:'Le compte propriétaire existe déjà. Connecte-toi.'},409);
    if (!env.ADMIN_EMAIL) return json({error:'Configure l’adresse propriétaire autorisée avant de créer le compte.'},503);
    if (password.length < 15) return json({error:'Le mot de passe doit contenir au moins 15 caractères.'},400);
    const salt = randomHex(16);
    const hash=await passwordHash(password,salt,env.TSU_AUTH_PEPPER);
    const result = await env.DB.prepare(
      'INSERT INTO tsu_owner (id,subject,email,salt,password_hash) VALUES (1,?,?,?,?) ON CONFLICT(id) DO NOTHING'
    ).bind(subject,email,salt,hash).run();
    if (!result.meta.changes) return json({error:'Le compte propriétaire existe déjà. Connecte-toi.'},409);
    return startSession(request,env,hash);
  }
  if (!matchesOwner(owner,subject,email)) return json({error:'Adresse e-mail ou mot de passe invalide.'},401);
  const now = epoch();
  const attempt = await env.DB.prepare(
    'UPDATE tsu_owner SET failed_attempts = CASE WHEN retry_after <= ? THEN 1 ELSE failed_attempts + 1 END, retry_after = CASE WHEN retry_after <= ? THEN ? ELSE retry_after END WHERE id = 1 AND (retry_after <= ? OR failed_attempts < 5)'
  ).bind(now,now,now+300,now).run();
  if (!attempt.meta.changes) return json({error:'Trop de tentatives. Réessaie dans quelques minutes.'},429);
  const hash = await passwordHash(password,owner.salt,env.TSU_AUTH_PEPPER);
  if (!equalHash(hash,owner.password_hash)) return json({error:'Adresse e-mail ou mot de passe invalide.'},401);
  await env.DB.prepare('UPDATE tsu_owner SET failed_attempts = 0, retry_after = 0 WHERE id = 1').bind().run();
  return startSession(request,env,hash);
}
