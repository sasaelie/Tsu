const json = (data, status = 200) => Response.json(data, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
});
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const idPattern = /^[a-z0-9-]{1,40}$/;
const stripeEnabled = env => /^(sk|rk)_test_/.test(env.STRIPE_TEST_KEY ?? '');
const readData = async (db, sql, ...args) => {
  const result = await db.prepare(sql).bind(...args).all();
  return result.results.map(row => ({ ...JSON.parse(row.data), ...(row.created_at ? { createdAt: row.created_at } : {}) }));
};

async function body(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) fail('Format JSON requis.');
  const raw = await request.text();
  if (raw.length > 30_000) fail('Données trop volumineuses.', 413);
  try { return JSON.parse(raw); } catch { fail('Données invalides.'); }
}

function productData(input) {
  const id = input.id || crypto.randomUUID();
  const name = text(input.name, 100);
  const price = input.price;
  const image = text(input.image, 2048);
  if (!idPattern.test(id) || !name || !['tee','acc'].includes(input.type) ||
      !Number.isInteger(price) || price < 50 || price > 999900) fail('Fiche produit invalide.');
  if (image) {
    let url;
    try { url = new URL(image); } catch { fail('URL de photo invalide.'); }
    if (url.protocol !== 'https:' || url.username || url.password) fail('Utilise une URL HTTPS pour la photo.');
  }
  if (!Array.isArray(input.variants) || input.variants.length > 40) fail('Variantes invalides.');
  const variants = input.variants.map(variant => {
    const size = text(variant.size, 32);
    const color = text(variant.color, 40);
    const syncId = Number(variant.syncId || 0);
    if (!Number.isSafeInteger(syncId) || syncId < 0) fail('Identifiant de variante Printful invalide.');
    return { id: idPattern.test(variant.id ?? '') ? variant.id : crypto.randomUUID(), size, color, syncId };
  });
  if (new Set(variants.map(variant => variant.id)).size !== variants.length ||
      new Set(variants.map(variant => (variant.size+'|'+variant.color).toLowerCase())).size !== variants.length) {
    fail('Les variantes doivent être distinctes.');
  }
  if (input.published && (!variants.length || variants.some(variant => !variant.syncId))) {
    fail('Associe chaque variante à Printful avant de publier.');
  }
  return { id, name, price, image, type:input.type, fr:text(input.fr,1500), en:text(input.en,1500),
    published: Boolean(input.published), featured:Boolean(input.featured), variants };
}

async function provider(url, options, label) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(12000) });
  if (!response.ok) {
    const error = Object.assign(new Error(label+' a refusé la requête ('+response.status+').'), { status:502, providerStatus:response.status });
    throw error;
  }
  return response.json();
}

async function printful(env, path, payload) {
  return (await provider('https://api.printful.com'+path, {
    method: payload ? 'POST' : 'GET',
    headers: { Authorization:'Bearer '+env.PRINTFUL_TOKEN,
      ...(env.PRINTFUL_STORE_ID ? { 'X-PF-Store-Id':env.PRINTFUL_STORE_ID } : {}),
      ...(payload ? { 'Content-Type':'application/json' } : {}) },
    body: payload ? JSON.stringify(payload) : undefined
  },'Printful')).result;
}

async function storefront(env) {
  return (await readData(env.DB,'SELECT data FROM storefront WHERE id = 1'))[0] ??
    { countries:['BE','FR'], tagFr:'', tagEn:'', pitchFr:'', pitchEn:'' };
}
const products = env => readData(env.DB,'SELECT data FROM products ORDER BY rowid DESC');

async function checkout(request, env, origin) {
  if (!stripeEnabled(env)) fail('Stripe en mode test reste à connecter.', 503);
  const { lines, country } = await body(request);
  const config = await storefront(env);
  if (!config.countries.includes(country) || !Array.isArray(lines) || !lines.length || lines.length > 20) fail('Panier ou pays invalide.');
  const available = await products(env);
  const items = lines.map(line => {
    const product = available.find(item => item.id === line.id && item.published);
    const variant = product?.variants.find(item => item.id === line.variantId);
    if (!variant?.syncId || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 20) fail('Un article du panier est indisponible.');
    return { name: [product.name,variant.size,variant.color].filter(Boolean).join(' · '), price:product.price, syncId:variant.syncId, quantity:line.quantity };
  });
  const id = crypto.randomUUID();
  const form = new URLSearchParams({
    mode:'payment', success_url:origin+'/?test=retour', cancel_url:origin+'/#collection',
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
    .bind(id,session.id,JSON.stringify({ id,country,items,payment:'unpaid',printful:'none' })).run();
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
  const expected = order.items.reduce((sum,item)=>sum+item.price*item.quantity,0);
  if (session.amount_total !== expected || session.currency !== 'eur') fail('Le total Stripe ne correspond pas à la commande.',502);
  order.payment = session.payment_status === 'paid' ? 'paid' : session.status === 'expired' ? 'expired' : 'unpaid';
  if (order.payment === 'paid' && env.PRINTFUL_TOKEN) {
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

async function handle(request, env) {
  const { pathname, origin } = new URL(request.url);
  const method = request.method;
  const admin = pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/admin/');
  const owner = request.headers.get('oai-authenticated-user-id');
  const email = request.headers.get('oai-authenticated-user-email');
  // Sites restricts this deployment to its owner. Require visitor identity in addition to the private ingress.
  if (admin && (!owner || (env.ADMIN_EMAIL && email?.toLowerCase() !== env.ADMIN_EMAIL.toLowerCase()))) {
    return owner ? json({ error:'Accès réservé au propriétaire.' },403)
      : pathname === '/admin' ? Response.redirect(origin+'/signin-with-chatgpt?returnTo=%2Fadmin',302)
      : json({ error:'Connexion propriétaire requise.' },401);
  }
  if (method !== 'GET' && request.headers.get('origin') !== origin) return json({ error:'Origine refusée.' },403);
  if (method === 'GET' && pathname === '/admin/') return Response.redirect(origin+'/admin',302);
  if (method === 'GET' && Object.hasOwn(assets,pathname)) {
    const [type, data] = assets[pathname];
    return new Response(Uint8Array.from(atob(data), char=>char.charCodeAt(0)),{
      headers: {'Content-Type':type,'X-Content-Type-Options':'nosniff', 'Cache-Control': admin ? 'no-store' : 'no-cache'}
    });
  }
  if (method === 'GET' && pathname === '/api/catalog') {
    const settings = await storefront(env);
    const items = (await products(env)).filter(product=>product.published)
      .sort((a,b)=>Number(b.featured)-Number(a.featured))
      .map(product=>({ ...product, variants:product.variants.map(({syncId,...variant})=>variant) }));
    return json({ items, settings, stripe:stripeEnabled(env) });
  }
  if (method === 'POST' && pathname === '/api/checkout' && owner) return checkout(request,env,origin);
  if (method === 'GET' && pathname === '/api/admin/state') {
    return json({ email, products:await products(env), settings:await storefront(env), stripe:stripeEnabled(env),
      printful:Boolean(env.PRINTFUL_TOKEN), orders:await readData(env.DB,'SELECT created_at, data FROM shop_orders ORDER BY created_at DESC LIMIT 100') });
  }
  if (method === 'POST' && pathname === '/api/admin/products') {
    const product = productData(await body(request));
    if (product.published && env.PRINTFUL_TOKEN) {
      for (const variant of product.variants) {
        const result = await printful(env,'/store/variants/'+variant.syncId);
        if (!result.sync_variant?.synced) fail('Une variante Printful est introuvable ou non synchronisée.');
      }
    }
    await env.DB.prepare('INSERT INTO products (id,data) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data')
      .bind(product.id,JSON.stringify(product)).run();
    return json(product);
  }
  if (method === 'POST' && pathname === '/api/admin/settings') {
    const input = await body(request);
    const countries = ['BE','FR'].filter(country=>Array.isArray(input.countries) && input.countries.includes(country));
    if (!countries.length) fail('Choisis au moins un pays de livraison.');
    const data = {countries,tagFr:text(input.tagFr,120),tagEn:text(input.tagEn,120),pitchFr:text(input.pitchFr,300),pitchEn:text(input.pitchEn,300)};
    await env.DB.prepare('INSERT INTO storefront (id,data) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').bind(JSON.stringify(data)).run();
    return json(data);
  }
  if (method === 'POST' && pathname === '/api/admin/orders/sync') return syncOrder(env,(await body(request)).id);
  return json({ error:'Page introuvable.' },404);
}

export default {
  async fetch(request, env) {
    try { return await handle(request, env); }
    catch (error) {
      if (!error.status) console.error(error.name, error.message);
      return json({ error:error.status ? error.message : 'Une erreur serveur est survenue.' },error.status ?? 500);
    }
  }
};
