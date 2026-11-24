async function automaticFulfillment(env) {
  const settings = await env.DB.prepare('SELECT enabled FROM fulfillment_settings WHERE id=1').first();
  return settings?.enabled === 1;
}

async function saveFulfillmentSettings(request, env) {
  const {enabled} = await body(request,512);
  if (typeof enabled !== 'boolean') fail('Choix de fabrication invalide.');
  await env.DB.prepare('INSERT INTO fulfillment_settings(id,enabled) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled')
    .bind(Number(enabled)).run();
  return json({enabled});
}

async function checkoutItems(env, config, customer, country, lines) {
  if (!config.countries.includes(country) || !Array.isArray(lines) || !lines.length || lines.length > 20 || lines.some(line=>!line || typeof line !== 'object')) fail('Panier ou pays invalide.');
  const available = await products(env);
  const member = newsletterAccess(customer,env);
  return lines.map(line => {
    const product = available.find(item => item.id === line.id && canViewProduct(item,member));
    const variant = product?.variants.find(item => item.id === line.variantId);
    if (!variant?.syncId || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 20) fail('Un article du panier est indisponible.');
    const label = [variant.size,variant.color].filter(Boolean).join(' · ') || variant.label;
    return { productId:product.id, path:productPath(product), name:[product.name,label].filter(Boolean).join(' · '), price:product.price,
      syncId:variant.syncId, catalogId:variant.catalogId, quantity:line.quantity };
  });
}

async function checkout(request, env, origin) {
  const { lines, country, language, direct, postalCode } = await body(request);
  const [config,profile,customer] = await Promise.all([storefront(env),shopProfile(env),customerSession(request,env)]);
  const mode = await checkoutMode(env,config,profile);
  const stripeKey = mode === 'live' ? liveStripeKey(env) : mode === 'test' ? await activeStripeKey(env) : null;
  if (!stripeKey) fail('Le paiement est momentanément indisponible.',503);
  const items = await checkoutItems(env,config,customer,country,lines);
  const shipping = profile.shipping?.[country];
  if (!shipping) fail('Configure les frais et le délai de livraison de ce pays dans l’administration.',409);
  const zip = deliveryZip(postalCode,country);
  const dates = zip ? await findDeliveryDates(env,items,country,zip) : null;
  const fallback = !profile.shippingPreview && shipping.min ? {...shipping,unit:'business_day'} : null;
  const estimate = dates ?? fallback;
  const id = crypto.randomUUID();
  const english = language === 'en';
  const home = languagePath('/',english);
  const directProduct = direct === true && items.length === 1;
  const returnPath = directProduct ? languagePath(items[0].path,english) : home;
  const form = new URLSearchParams({
    mode:'payment', success_url:origin+home+'?checkout_session={CHECKOUT_SESSION_ID}',
    cancel_url:origin+returnPath+'?checkout=cancelled'+(directProduct ? '' : '#collection'),
    locale:english ? 'en' : 'fr',
    'adaptive_pricing[enabled]':'false',
    'metadata[tsu_order_id]':id,
    'shipping_options[0][shipping_rate_data][type]':'fixed_amount',
    'shipping_options[0][shipping_rate_data][display_name]':language === 'en' ? 'Standard delivery' : 'Livraison standard',
    'shipping_options[0][shipping_rate_data][fixed_amount][currency]':'eur',
    'shipping_options[0][shipping_rate_data][fixed_amount][amount]':String(shipping.fee),
    'shipping_address_collection[allowed_countries][0]':country,
    integration_identifier:'tsu-checkout-fzxqcrmt', client_reference_id:id
  });
  if (estimate) {
    for (const [bound,days] of [['minimum',estimate.min],['maximum',estimate.max]]) {
      const field = 'shipping_options[0][shipping_rate_data][delivery_estimate]['+bound+']';
      form.set(field+'[unit]',estimate.unit);
      form.set(field+'[value]',String(days));
    }
  }
  if (customer?.verified_at) form.set('customer_email',customer.email);
  if (mode === 'live') {
    form.set('automatic_tax[enabled]','true');
    form.set('shipping_options[0][shipping_rate_data][tax_behavior]','inclusive');
  }
  items.forEach((item,index) => {
    const key = 'line_items['+index+']';
    form.set(key+'[price_data][currency]','eur');
    form.set(key+'[price_data][unit_amount]',String(item.price));
    if (mode === 'live') form.set(key+'[price_data][tax_behavior]','inclusive');
    form.set(key+'[price_data][product_data][name]',item.name);
    form.set(key+'[quantity]',String(item.quantity));
  });
  const autoFulfill = mode === 'live' && await automaticFulfillment(env);
  const session = await stripeRequest(stripeKey,'/checkout/sessions',form,id);
  if (session.livemode !== (mode === 'live') || !stripeSessionPattern.test(session.id ?? '') ||
      !session.url || new URL(session.url).origin !== 'https://checkout.stripe.com') fail('Session Stripe invalide.',502);
  const savedItems = items.map(({productId,name,price,syncId,quantity})=>({productId,name,price,syncId,quantity}));
  await env.DB.prepare('INSERT INTO shop_orders (id,session_id,data,customer_id) VALUES (?,?,?,?)')
    .bind(id,session.id,JSON.stringify({ id,mode,autoFulfill,country,items:savedItems,shippingFee:shipping.fee,payment:'unpaid',printful:'none' }),customer?.id ?? null).run();
  return json({ url:session.url, sessionId:session.id });
}

async function syncOrder(env, id) {
  if (typeof id !== 'string' || !idPattern.test(id)) fail('Commande indisponible.');
  const row = await env.DB.prepare('SELECT session_id, data FROM shop_orders WHERE id = ?').bind(id).first();
  if (!row?.session_id) fail('Commande introuvable.',404);
  return json(await reconcileOrder(env,row));
}

async function checkoutResult(request, env) {
  const {sessionId} = await body(request,1024);
  if (typeof sessionId !== 'string' || !stripeSessionPattern.test(sessionId)) fail('Session introuvable.',404);
  const row = await env.DB.prepare('SELECT session_id, data FROM shop_orders WHERE session_id = ?').bind(sessionId).first();
  if (!row) fail('Session introuvable.',404);
  const saved = JSON.parse(row.data);
  const order = saved.payment === 'paid' && saved.printfulId ? saved : await reconcileOrder(env,row);
  return json({
    reference:order.id, payment:order.payment, mode:order.mode ?? 'test',
    analytics:order.payment==='paid'?{shipping:(order.shippingFee??0)/100,items:order.items.map(item=>({
      item_id:item.productId || String(item.syncId),item_name:item.name,price:item.price/100,quantity:item.quantity
    }))}:null,
    total:order.items.reduce((sum,item)=>sum+item.price*item.quantity,0) + (order.shippingFee ?? 0)
  });
}

// Keep each Printful order tied to one TSŪ order even if a webhook, return
// page and tracking refresh arrive together. Expired leases recover crashes.
async function claimFulfillment(env,id,token) {
  const now = epoch();
  return env.DB.prepare(`UPDATE shop_orders SET data=json_set(data,'$.payment','paid'),
    sync_token=?, sync_expires=? WHERE id=? AND sync_expires<=? RETURNING data`)
    .bind(token,now+180,id,now).first();
}

async function currentOrder(env,id) {
  const row=await env.DB.prepare('SELECT data FROM shop_orders WHERE id=?').bind(id).first();
  return JSON.parse(row.data);
}

async function finishFulfillment(env,id,token,changes) {
  const row=await env.DB.prepare(`UPDATE shop_orders SET data=json_patch(data,?),
    sync_token=NULL,sync_expires=0 WHERE id=? AND sync_token=? RETURNING data`)
    .bind(JSON.stringify(changes),id,token).first();
  return row ? JSON.parse(row.data) : currentOrder(env,id);
}

function supplierState(order) {
  if (!Number.isSafeInteger(order?.id) || order.id<1 || !order.status) fail('Réponse de commande Printful incomplète.',502);
  return {printfulId:order.id, printful:order.status, shipments:(order.shipments ?? []).map(shipment=>({
    number:shipment.tracking_number,url:shipment.tracking_url
  }))};
}

async function reconcileOrder(env, row, eventType) {
  const order = JSON.parse(row.data);
  const {id} = order;
  const live = order.mode === 'live';
  const stripeKey = live ? liveStripeKey(env) : await activeStripeKey(env);
  if (!stripeKey) fail('La connexion Stripe de cette commande est indisponible.',503);
  const session = await stripeRequest(stripeKey,'/checkout/sessions/'+encodeURIComponent(row.session_id));
  if (session.livemode !== live || session.client_reference_id !== id) fail('Session Stripe invalide.',502);
  const expected = order.items.reduce((sum,item)=>sum+item.price*item.quantity,0) + (order.shippingFee ?? 0);
  if (session.amount_total !== expected || session.currency !== 'eur') fail('Le total Stripe ne correspond pas à la commande.',502);
  if (session.payment_status !== 'paid') {
    const payment = session.status === 'expired' ? 'expired'
      : eventType === 'checkout.session.async_payment_failed' ? 'failed' : null;
    if (!payment || order.payment === 'paid') return order;
    const updated = await env.DB.prepare("UPDATE shop_orders SET data = json_set(data, '$.payment', ?) WHERE id = ? AND json_extract(data, '$.payment') <> 'paid' RETURNING data")
      .bind(payment,id).first();
    return updated ? JSON.parse(updated.data) : {...order,payment:'paid'};
  }
  if (live && session.automatic_tax?.status !== 'complete') fail('Stripe Tax n’a pas confirmé le calcul de cette commande.',502);
  const token=crypto.randomUUID();
  const claim=await claimFulfillment(env,id,token);
  if (!claim) return {...await currentOrder(env,id),syncInProgress:true};
  const paidOrder=JSON.parse(claim.data);
  let changes={};
  try {
    if (!await activePrintful(env)) fail('Printful reste à connecter.',503);
    const shipping = session.collected_information?.shipping_details ?? session.shipping_details;
    const address = shipping?.address;
    if (!address?.line1 || !address.postal_code || !address.city || address.country !== order.country || !shipping.name) fail('Adresse de livraison incomplète.');
    const supplierOrder=await orderDraft(env,paidOrder,shipping,address);
    changes=supplierState(supplierOrder);
    if (live && salesEnabled(env) && paidOrder.autoFulfill === true && supplierOrder.status==='draft' && await automaticFulfillment(env)) {
      const confirmed=await printful(env,'/orders/'+supplierOrder.id+'/confirm',{});
      if (confirmed?.id !== supplierOrder.id) fail('Confirmation Printful à vérifier.',502);
      changes=supplierState(confirmed);
      if (confirmed.status==='draft') fail('Printful attend toujours la confirmation de fabrication.',502);
    }
    changes.error='';
  } catch (error) {
    changes.error=error.status ? error.message : 'Impossible de joindre Printful.';
  }
  return finishFulfillment(env,id,token,changes);
}

async function orderDraft(env, order, shipping, address) {
  if (order.printfulId) return printful(env,'/orders/'+order.printfulId);
  // Printful caps external IDs at 32 characters. A UUID without hyphens fits exactly.
  const externalId = order.id.replaceAll('-','');
  const lookupPath = '/orders/@'+externalId;
  try { return await printful(env,lookupPath); }
  catch (error) { if (error.providerStatus !== 404) throw error; }
  try {
    return await printful(env,'/orders?confirm=false',{
      external_id:externalId,
      recipient:{ name:shipping.name,address1:address.line1,address2:address.line2 ?? '',
        city:address.city,country_code:address.country,zip:address.postal_code },
      items:order.items.map(item=>({ sync_variant_id:item.syncId,quantity:item.quantity }))
    });
  } catch (createError) {
    if (![400,409].includes(createError.providerStatus)) throw createError;
    try { return await printful(env,lookupPath); }
    catch (lookupError) { throw lookupError.providerStatus === 404 ? createError : lookupError; }
  }
}

