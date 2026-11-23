const json = (data, status = 200) => Response.json(data, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
});
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const idPattern = /^[a-z0-9-]{1,40}$/;
const readData = async (db, sql, ...args) => {
  const result = await db.prepare(sql).bind(...args).all();
  return result.results.map(row => ({ ...JSON.parse(row.data), ...(row.created_at ? { createdAt: row.created_at } : {}) }));
};

async function body(request, max = 30_000) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) fail('Format JSON requis.');
  const raw = await request.text();
  if (raw.length > max) fail('Données trop volumineuses.', 413);
  let data;
  try { data = JSON.parse(raw); } catch { fail('Données invalides.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail('Données invalides.');
  return data;
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
  if (!Array.isArray(input.variants) || input.variants.length > 100) fail('Variantes invalides.');
  const variants = input.variants.map(variant => {
    const size = text(variant.size, 32);
    const color = text(variant.color, 40);
    const syncId = Number(variant.syncId || 0);
    if (!Number.isSafeInteger(syncId) || syncId < 0) fail('Identifiant de variante Printful invalide.');
    return { id: idPattern.test(variant.id ?? '') ? variant.id : crypto.randomUUID(), size, color, syncId, label:text(variant.label,100) };
  });
  if (new Set(variants.map(variant => variant.id)).size !== variants.length ||
      new Set(variants.map(variant => (variant.size+'|'+variant.color+'|'+(!variant.size && !variant.color ? variant.label : '')).toLowerCase())).size !== variants.length) {
    fail('Les variantes doivent être distinctes.');
  }
  if (input.published && (!variants.length || variants.some(variant => !variant.syncId))) {
    fail('Associe chaque variante à Printful avant de publier.');
  }
  return { id, name, price, image, type:input.type, fr:text(input.fr,1500), en:text(input.en,1500), material:text(input.material,250), care:text(input.care,500), sizing:text(input.sizing,500), safety:text(input.safety,1200),
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

async function printful(env, path, payload, config, fullResponse = false) {
  const connection = config ?? await activePrintful(env);
  if (!connection) fail('Printful reste à connecter.',503);
  const response = await provider('https://api.printful.com'+path, {
    method: payload ? 'POST' : 'GET',
    redirect: 'manual',
    headers: { Authorization:'Bearer '+connection.token,
      ...(connection.storeId ? { 'X-PF-Store-Id':connection.storeId } : {}),
      ...(payload ? { 'Content-Type':'application/json' } : {}) },
    body: payload ? JSON.stringify(payload) : undefined
  },'Printful');
  return fullResponse ? response : response.result;
}

async function storefront(env) {
  return (await readData(env.DB,'SELECT data FROM storefront WHERE id = 1'))[0] ??
    { countries:['BE','FR'], tagFr:'', tagEn:'', pitchFr:'', pitchEn:'' };
}
const products = env => readData(env.DB,'SELECT data FROM products ORDER BY rowid DESC');

async function handle(request, env) {
  const { pathname, origin, searchParams } = new URL(request.url);
  const method = request.method;
  const tab = searchParams.get('tab');
  const deepLink = ['products','settings','profile','printful','orders'].includes(tab) ? tab : '';
  const admin = pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/admin/');
  const owner = request.headers.get('oai-authenticated-user-id');
  const email = request.headers.get('oai-authenticated-user-email');
  const account = pathname === '/compte' || pathname.startsWith('/compte/') || pathname.startsWith('/api/account/');
  // The private Sites gate verifies the owner before the separate TSŪ login.
  if ((admin || account) && (!owner || (env.ADMIN_EMAIL && email?.toLowerCase() !== env.ADMIN_EMAIL.toLowerCase()))) {
    return owner ? json({ error:'Accès réservé au propriétaire.' },403)
      : pathname === '/admin' || pathname === '/compte' ? Response.redirect(origin+'/signin-with-chatgpt?returnTo='+encodeURIComponent(pathname + (pathname === '/admin' && deepLink ? '?tab='+deepLink : '')),302)
      : json({ error:'Connexion propriétaire requise.' },401);
  }
  if (method !== 'GET' && request.headers.get('origin') !== origin) return json({ error:'Origine refusée.' },403);
  if (pathname.startsWith('/api/account/')) return accountRoute(request,env,pathname.slice('/api/account/'.length),owner,email);
  if (admin && pathname !== '/admin/style.css' && !await ownerSession(request,env,owner)) {
    return pathname === '/admin' || pathname === '/admin/' ? Response.redirect(origin+'/compte'+(deepLink ? '?destination='+deepLink : ''),302)
      : json({error:'Connecte-toi à ton compte TSŪ.'},401);
  }
  if (method === 'GET' && pathname === '/compte/') return Response.redirect(origin+'/compte',302);
  if (method === 'GET' && pathname === '/admin/') return Response.redirect(origin+'/admin'+(deepLink ? '?tab='+deepLink : ''),302);
  if (method === 'GET' && (pathname === '/robots.txt' || pathname === '/sitemap.xml' || storefrontRoute(pathname))) {
    return renderStorefront(request,env);
  }
  if (method === 'GET' && Object.hasOwn(assets,pathname)) {
    const [type, data] = assets[pathname];
    return new Response(Uint8Array.from(atob(data), char=>char.charCodeAt(0)),{
      headers: {'Content-Type':type,'X-Content-Type-Options':'nosniff', 'Cache-Control': admin || account ? 'no-store' : 'no-cache'}
    });
  }
  if (method === 'GET' && pathname === '/api/catalog') {
    const settings = await storefront(env);
    const items = (await products(env)).filter(product=>product.published)
      .sort((a,b)=>Number(b.featured)-Number(a.featured))
      .map(product=>({ ...product, variants:product.variants.map(({syncId,...variant})=>variant) }));
    return json({ items, settings, stripe:await stripeEnabled(env) });
  }
  if (method === 'POST' && pathname === '/api/checkout' && owner) return checkout(request,env,origin);
  if (method === 'POST' && pathname === '/api/admin/printful/import') return importPrintfulPage(env,(await body(request)).offset);
  if (method === 'POST' && pathname === '/api/admin/printful') return printfulSetup(request,env);
  if (method === 'POST' && pathname === '/api/admin/stripe') return saveStripeConnection(request,env);
  if (method === 'POST' && pathname === '/api/admin/profile') return saveShopProfile(request,env);
  if (method === 'GET' && pathname === '/api/admin/state') {
    const connection = await readPrintfulConnection(env);
    return json({ email, products:await products(env), settings:await storefront(env), profile:await shopProfile(env), stripe:await stripeEnabled(env),
      printful:Boolean(connection || env.PRINTFUL_TOKEN), printfulStore:connection?.store_name, orders:await readData(env.DB,'SELECT created_at, data FROM shop_orders ORDER BY created_at DESC LIMIT 100') });
  }
  if (method === 'POST' && pathname === '/api/admin/products') {
    const product = productData(await body(request));
    if (product.published) await validatePrintfulVariants(env,product);
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
