async function checkout(request, env, origin) {
  if (!stripeEnabled(env)) fail('Stripe en mode test reste à connecter.', 503);
  const { lines, country, language } = await body(request);
  const config = await storefront(env);
  if (!config.countries.includes(country) || !Array.isArray(lines) || !lines.length || lines.length > 20 || lines.some(line=>!line || typeof line !== 'object')) fail('Panier ou pays invalide.');
  const shipping = (await shopProfile(env)).shipping?.[country];
  if (!shipping) fail('Configure les frais et le délai de livraison de ce pays dans l’administration.',409);
  const available = await products(env);
  const items = lines.map(line => {
    const product = available.find(item => item.id === line.id && item.published);
    const variant = product?.variants.find(item => item.id === line.variantId);
    if (!variant?.syncId || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 20) fail('Un article du panier est indisponible.');
    const label = [variant.size,variant.color].filter(Boolean).join(' · ') || variant.label;
    return { name:[product.name,label].filter(Boolean).join(' · '), price:product.price, syncId:variant.syncId, quantity:line.quantity };
  });
  const id = crypto.randomUUID();
  const form = new URLSearchParams({
    mode:'payment', success_url:origin+'/?test=retour', cancel_url:origin+'/#collection',
    locale:language === 'en' ? 'en' : 'fr',
    'shipping_options[0][shipping_rate_data][type]':'fixed_amount',
    'shipping_options[0][shipping_rate_data][display_name]':language === 'en' ? 'Standard delivery' : 'Livraison standard',
    'shipping_options[0][shipping_rate_data][fixed_amount][currency]':'eur',
    'shipping_options[0][shipping_rate_data][fixed_amount][amount]':String(shipping.fee),
    'shipping_options[0][shipping_rate_data][delivery_estimate][minimum][unit]':'business_day',
    'shipping_options[0][shipping_rate_data][delivery_estimate][minimum][value]':String(shipping.min),
    'shipping_options[0][shipping_rate_data][delivery_estimate][maximum][unit]':'business_day',
    'shipping_options[0][shipping_rate_data][delivery_estimate][maximum][value]':String(shipping.max),
    'shipping_address_collection[allowed_countries][0]':country,
    'payment_method_types[0]':'card', client_reference_id:id
  });
  items.forEach((item,index) => {
    const key = 'line_items['+index+']';
    form.set(key+'[price_data][currency]','eur');
    form.set(key+'[price_data][unit_amount]',String(item.price));
    form.set(key+'[price_data][product_data][name]',item.name);
    form.set(key+'[quantity]',String(item.quantity));
  });
  const session = await provider('https://api.stripe.com/v1/checkout/sessions', {
    method:'POST', headers:{ Authorization:'Bearer '+env.STRIPE_TEST_KEY, 'Content-Type':'application/x-www-form-urlencoded', 'Idempotency-Key':id }, body:form
  },'Stripe');
  if (session.livemode !== false || !session.url || new URL(session.url).origin !== 'https://checkout.stripe.com') fail('Session Stripe de test invalide.',502);
  await env.DB.prepare('INSERT INTO shop_orders (id, session_id, data) VALUES (?, ?, ?)')
    .bind(id,session.id,JSON.stringify({ id,country,items,shippingFee:shipping.fee,payment:'unpaid',printful:'none' })).run();
  return json({ url:session.url });
}

async function syncOrder(env, id) {
  if (!stripeEnabled(env) || !idPattern.test(id)) fail('Commande de test indisponible.');
  const row = await env.DB.prepare('SELECT session_id, data FROM shop_orders WHERE id = ?').bind(id).first();
  if (!row) fail('Commande introuvable.',404);
  const order = JSON.parse(row.data);
  const session = await provider('https://api.stripe.com/v1/checkout/sessions/'+encodeURIComponent(row.session_id),{
    headers:{Authorization:'Bearer '+env.STRIPE_TEST_KEY}
  },'Stripe');
  if (session.livemode !== false || session.client_reference_id !== id) fail('Session Stripe invalide.',502);
  const expected = order.items.reduce((sum,item)=>sum+item.price*item.quantity,0) + (order.shippingFee ?? 0);
  if (session.amount_total !== expected || session.currency !== 'eur') fail('Le total Stripe ne correspond pas à la commande.',502);
  order.payment = session.payment_status === 'paid' ? 'paid' : session.status === 'expired' ? 'expired' : 'unpaid';
  if (order.payment === 'paid' && await activePrintful(env)) {
    const shipping = session.collected_information?.shipping_details ?? session.shipping_details;
    const address = shipping?.address;
    if (!address?.line1 || !address.postal_code || !address.city || address.country !== order.country || !shipping.name) fail('Adresse de livraison incomplète.');
    try {
      let draft;
      const externalId = 'tsu-'+id;
      try { draft = await printful(env,'/orders/@'+externalId); }
      catch (error) {
        if (error.providerStatus !== 404) throw error;
        try {
          draft = await printful(env,'/orders?confirm=false',{
            external_id:externalId,
            recipient:{ name:shipping.name,address1:address.line1,address2:address.line2 ?? '',
              city:address.city,country_code:address.country,zip:address.postal_code },
            items:order.items.map(item=>({ sync_variant_id:item.syncId,quantity:item.quantity }))
          });
        } catch (createError) {
          if (![400,409].includes(createError.providerStatus)) throw createError;
          draft = await printful(env,'/orders/@'+externalId);
        }
      }
      order.printful = draft.status;
      order.printfulId = draft.id;
      order.error = '';
      order.shipments = (draft.shipments ?? []).map(shipment=>({ number:shipment.tracking_number, url:shipment.tracking_url }));
    } catch (error) {
      order.error = error.status ? error.message : 'Impossible de joindre Printful.';
    }
  }
  await env.DB.prepare('UPDATE shop_orders SET data = ? WHERE id = ?').bind(JSON.stringify(order),id).run();
  return json(order);
}

