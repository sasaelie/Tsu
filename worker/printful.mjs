async function printfulKey(secret) {
  if (!/^[a-f0-9]{64}$/.test(secret ?? '')) fail('Configuration Printful indisponible.',503);
  const bytes = Uint8Array.from(secret.match(/../g),byte=>parseInt(byte,16));
  return crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt']);
}

function binaryBase64(value) {
  return btoa(String.fromCharCode(...new Uint8Array(value)));
}

function base64Binary(value) {
  return Uint8Array.from(atob(value),char=>char.charCodeAt(0));
}

function readPrintfulConnection(env) {
  return env.DB.prepare('SELECT encrypted_token, nonce, store_name FROM printful_connection WHERE id = 1').bind().first();
}

async function activePrintful(env) {
  const stored = await readPrintfulConnection(env);
  if (stored) {
    const key = await printfulKey(env.TSU_PRINTFUL_ENCRYPTION_KEY);
    const value = await crypto.subtle.decrypt({name:'AES-GCM',iv:base64Binary(stored.nonce)},key,base64Binary(stored.encrypted_token));
    return { token:new TextDecoder().decode(value) };
  }
  return env.PRINTFUL_TOKEN ? { token:env.PRINTFUL_TOKEN,storeId:env.PRINTFUL_STORE_ID } : null;
}

async function printfulSetup(request,env) {
  const token = text((await body(request))?.token,4097);
  if (!/^[A-Za-z0-9._~+\/=-]{20,4096}$/.test(token)) fail('Jeton Printful invalide.');
  const key = await printfulKey(env.TSU_PRINTFUL_ENCRYPTION_KEY);
  const config = {token};
  const stores = await printful(env,'/stores',undefined,config);
  if (!Array.isArray(stores) || stores.length !== 1) fail('Crée un jeton limité à une seule boutique Printful.');
  await Promise.all([
    printful(env,'/store/products?limit=1',undefined,config),
    printful(env,'/orders?limit=1',undefined,config)
  ]);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},key,encoder.encode(token));
  const store = text(stores[0].name,150) || 'Boutique Printful';
  await env.DB.prepare('INSERT INTO printful_connection (id, encrypted_token, nonce, store_name) VALUES (1,?,?,?) ON CONFLICT (id) DO UPDATE SET encrypted_token=excluded.encrypted_token, nonce=excluded.nonce, store_name=excluded.store_name')
    .bind(binaryBase64(ciphertext),binaryBase64(nonce),store).run();
  return json({store});
}
