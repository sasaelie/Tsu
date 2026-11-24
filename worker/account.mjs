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

async function startSession(request, env) {
  const old = sessionToken(request);
  if (old) await env.DB.prepare('DELETE FROM tsu_sessions WHERE token_hash = ?').bind(await sha256(old)).run();
  await env.DB.prepare('DELETE FROM tsu_sessions WHERE expires_at <= ?').bind(epoch()).run();
  const token = randomHex(32);
  await env.DB.prepare('INSERT INTO tsu_sessions (token_hash,expires_at) VALUES (?,?)')
    .bind(await sha256(token),epoch()+sessionLifetime).run();
  return setSessionCookie(json({ok:true}),token,sessionLifetime);
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
    if (password.length < 15) return json({error:'Le mot de passe doit contenir au moins 15 caractères.'},400);
    const salt = randomHex(16);
    const result = await env.DB.prepare(
      'INSERT INTO tsu_owner (id,subject,email,salt,password_hash) VALUES (1,?,?,?,?) ON CONFLICT(id) DO NOTHING'
    ).bind(subject,email,salt,await passwordHash(password,salt,env.TSU_AUTH_PEPPER)).run();
    if (!result.meta.changes) return json({error:'Le compte propriétaire existe déjà. Connecte-toi.'},409);
    return startSession(request,env);
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
  return startSession(request,env);
}
