const stripeApiVersion = '2026-11-18.endive';
const stripeTestKeyPattern = /^(?:sk|rk)_test_[A-Za-z0-9]{12,500}$/;

function readStripeConnection(env) {
  return env.DB.prepare('SELECT encrypted_key, nonce FROM stripe_connection WHERE id = 1').bind().first();
}

async function stripeEnabled(env) {
  const stored = await readStripeConnection(env);
  return stored ? Boolean(env.TSU_STRIPE_ENCRYPTION_KEY) : stripeTestKeyPattern.test(env.STRIPE_TEST_KEY ?? '');
}

async function activeStripeKey(env) {
  const stored = await readStripeConnection(env);
  if (!stored) return stripeTestKeyPattern.test(env.STRIPE_TEST_KEY ?? '') ? env.STRIPE_TEST_KEY : null;
  const key = await credentialKey(env.TSU_STRIPE_ENCRYPTION_KEY,'Stripe');
  const raw = await crypto.subtle.decrypt({name:'AES-GCM',iv:base64Binary(stored.nonce)},key,base64Binary(stored.encrypted_key));
  const token = new TextDecoder().decode(raw);
  return stripeTestKeyPattern.test(token) ? token : null;
}

async function stripeRequest(key, path, form, idempotencyKey) {
  return provider('https://api.stripe.com/v1'+path,{
    method:form ? 'POST' : 'GET',
    redirect:'manual',
    headers:{
      Authorization:'Bearer '+key,
      'Stripe-Version':stripeApiVersion,
      ...(form ? {'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':idempotencyKey} : {})
    },
    body:form
  },'Stripe');
}

function stripeKeyInputError(token) {
  if (token.startsWith('pk_')) return 'Tu as saisi une clé publique (pk_). Utilise une clé restreinte de test (rk_test_).';
  if (/^(?:rk|sk)_live_/.test(token)) return 'Cette clé appartient au mode réel. Utilise une clé restreinte de test (rk_test_).';
  if (token.startsWith('sk_test_')) return 'Cette clé secrète n’est pas restreinte. Crée une clé de test qui commence par rk_test_.';
  if (!token.startsWith('rk_test_') || !stripeTestKeyPattern.test(token)) {
    return 'Colle la clé restreinte de test complète. Elle commence par rk_test_.';
  }
  return '';
}

async function saveStripeConnection(request, env) {
  const {key:input} = await body(request);
  const token = text(input,510);
  const message = stripeKeyInputError(token);
  if (message) fail(message);
  const key = await credentialKey(env.TSU_STRIPE_ENCRYPTION_KEY,'Stripe');
  let list;
  try { list = await stripeRequest(token,'/checkout/sessions?limit=1'); }
  catch (error) {
    if (error.providerStatus === 401) fail('Stripe a refusé cette clé de test.');
    if (error.providerStatus === 403) fail('Autorise la lecture et l’écriture de Checkout Sessions dans Stripe.');
    throw error;
  }
  if (!Array.isArray(list.data) || list.data.some(session=>session.livemode !== false)) {
    fail('Stripe n’a pas confirmé un environnement de test.',502);
  }
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},key,encoder.encode(token));
  await env.DB.prepare('INSERT INTO stripe_connection (id,encrypted_key,nonce) VALUES (1,?,?) ON CONFLICT (id) DO UPDATE SET encrypted_key=excluded.encrypted_key,nonce=excluded.nonce')
    .bind(binaryBase64(ciphertext),binaryBase64(nonce)).run();
  return json({connected:true});
}
