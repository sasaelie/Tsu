const checkoutEvents = new Set([
  'checkout.session.completed','checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed','checkout.session.expired'
]);

async function verifyStripeSignature(header, payload, secret) {
  const parts = header.split(',').map(part=>part.trim());
  const timestamp = parts.find(part=>part.startsWith('t='))?.slice(2);
  if (!/^\d{1,12}$/.test(timestamp ?? '') || Math.abs(Date.now()/1000 - Number(timestamp)) > 300) return false;
  const signatures = parts.filter(part=>/^v1=[a-f0-9]{64}$/i.test(part));
  if (!signatures.length) return false;
  const key = await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const prefix = encoder.encode(timestamp+'.');
  const message = new Uint8Array(prefix.length+payload.length);
  message.set(prefix);
  message.set(payload,prefix.length);
  for (const signature of signatures) {
    const bytes = Uint8Array.from(signature.slice(3).match(/../g), hex=>Number.parseInt(hex,16));
    if (await crypto.subtle.verify('HMAC',key,bytes,message)) return true;
  }
  return false;
}

async function stripeWebhook(request, env, mode) {
  const secret = mode === 'live' ? env.STRIPE_LIVE_WEBHOOK_SECRET : env.STRIPE_TEST_WEBHOOK_SECRET;
  if (!stripeWebhookSecretPattern.test(secret ?? '')) fail('Webhook Stripe indisponible.',503);
  const signature = request.headers.get('stripe-signature') ?? '';
  if (!signature || signature.length > 4096) fail('Signature Stripe invalide.');
  const maxSize = 256_000;
  if (Number(request.headers.get('content-length')) > maxSize) fail('Événement trop volumineux.',413);
  const payload = new Uint8Array(await request.arrayBuffer());
  if (payload.length > maxSize) fail('Événement trop volumineux.',413);
  if (!await verifyStripeSignature(signature,payload,secret)) fail('Signature Stripe invalide.');
  let event;
  try { event = JSON.parse(new TextDecoder().decode(payload)); } catch { fail('Événement Stripe invalide.'); }
  if (!event || event.livemode !== (mode === 'live')) fail('Environnement Stripe invalide.');
  if (!checkoutEvents.has(event.type)) return json({received:true});
  const sessionId = event.data?.object?.id;
  if (typeof sessionId !== 'string' || !stripeSessionPattern.test(sessionId)) fail('Session Stripe invalide.');
  const row = await env.DB.prepare('SELECT session_id, data FROM shop_orders WHERE session_id = ?').bind(sessionId).first();
  if (!row) return json({received:true});
  const saved = JSON.parse(row.data);
  if ((saved.mode ?? 'test') !== mode) fail('Environnement de commande invalide.');
  if (saved.payment === 'paid' && saved.printfulId) return json({received:true});
  const order = await reconcileOrder(env,row,event.type);
  if (order.payment === 'paid' && !order.printfulId) fail('La création du brouillon Printful sera réessayée.',503);
  return json({received:true});
}
