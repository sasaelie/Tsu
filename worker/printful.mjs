function readPrintfulConnection(env) {
  return env.DB.prepare('SELECT encrypted_token, nonce, store_name FROM printful_connection WHERE id = 1').bind().first();
}

async function activePrintful(env) {
  const stored = await readPrintfulConnection(env);
  if (stored) {
    const key = await credentialKey(env.TSU_PRINTFUL_ENCRYPTION_KEY,'Printful');
    const value = await crypto.subtle.decrypt({name:'AES-GCM',iv:base64Binary(stored.nonce)},key,base64Binary(stored.encrypted_token));
    return { token:new TextDecoder().decode(value) };
  }
  return env.PRINTFUL_TOKEN ? { token:env.PRINTFUL_TOKEN,storeId:env.PRINTFUL_STORE_ID } : null;
}

async function printfulSetup(request,env) {
  const token = text((await body(request))?.token,4097);
  if (!/^[A-Za-z0-9._~+\/=-]{20,4096}$/.test(token)) fail('Jeton Printful invalide.');
  const key = await credentialKey(env.TSU_PRINTFUL_ENCRYPTION_KEY,'Printful');
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

function importVariant(variant) {
  const syncId = Number(variant.id);
  if (!Number.isSafeInteger(syncId) || syncId < 1 || !variant.synced || variant.is_ignored === true) return null;
  const parts = /\(([^()]+)\s+\/\s+([^()]+)\)$/.exec(variant.product?.name ?? '');
  return {
    id:'pfv-'+syncId, syncId, catalogId:Number(variant.variant_id ?? variant.product?.variant_id) || undefined,
    size:text(variant.size || parts?.[2],32),
    color:text(variant.color || parts?.[1],40),
    label:text(variant.name,100)
  };
}

function importedProduct(source, detail) {
  const product = detail.sync_product ?? source;
  const synced = Array.isArray(detail.sync_variants) ? detail.sync_variants : [];
  const selected = synced.map(sourceVariant=>({ sourceVariant, variant:importVariant(sourceVariant) }))
    .filter(item=>item.variant);
  const variants = selected.map(item=>item.variant);
  const prices = selected.map(({sourceVariant:variant})=>{
    if (variant.currency !== 'EUR' || !/^\d+(\.\d{1,2})?$/.test(String(variant.retail_price))) return null;
    const cents = Math.round(Number(variant.retail_price)*100);
    return cents >= 50 && cents <= 999900 ? cents : null;
  });
  const price = prices.length && prices.every(value=>value === prices[0]) ? prices[0] : null;
  const names = [product.name,...synced.map(variant=>variant.product?.name)].filter(Boolean).join(' ');
  const type = /\b(?:t[\s-]?shirts?|tees?)\b/i.test(names) ? 'tee'
    : /\b(?:hoodies?|hooded|sweat(?:[\s-]?shirts?)?s?|pulls?|jumpers?|sweaters?)\b/i.test(names) ? 'sweat'
    : /\b(?:totes?|bags?|sacs?|casquettes?|caps?|hats?|beanies?|bonnets?|stickers?|mugs?|accessoires?)\b/i.test(names) ? 'acc' : '';
  const thumbnail = [product.thumbnail_url,source.thumbnail_url].find(value=>{
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && value.length <= 2048; }
    catch { return false; }
  });
  return {
    id:'pf-'+source.id, name:text(product.name,100) || 'Produit Printful '+source.id,
    type, price, variants, image:thumbnail ?? '',
    fr:text(product.description_fr ?? '',1500), en:text(product.description_en ?? '',1500),
    published:false, featured:false
  };
}

async function importPrintfulPage(env, offset) {
  if (!Number.isSafeInteger(offset) || offset < 0) fail('Position de synchronisation invalide.');
  const connection = await activePrintful(env);
  if (!connection) fail('Connecte Printful avant de synchroniser.',503);
  const limit = 8;
  const page = await printful(env,'/store/products?limit='+limit+'&offset='+offset,undefined,connection,true);
  if (!Array.isArray(page.result)) fail('Catalogue Printful indisponible.',502);
  const existing = await products(env);
  const ids = new Set(existing.map(product=>product.id));
  const existingVariants = new Set(existing.flatMap(product=>product.variants.map(variant=>variant.syncId)).filter(Boolean));
  const candidates = page.result.slice(0,limit).filter(product=>
    Number.isSafeInteger(product.id) && product.id > 0 && product.is_ignored !== true && !ids.has('pf-'+product.id)
  );
  const rows = await Promise.allSettled(candidates.map(async source=>{
    const detail = await printful(env,'/store/products/'+source.id,undefined,connection);
    return importedProduct(source,detail);
  }));
  let added = 0;
  let failed = 0;
  for (const row of rows) {
    if (row.status === 'rejected') {
      failed++;
      continue;
    }
    const draft = row.value;
    if (draft.variants.some(variant=>existingVariants.has(variant.syncId))) continue;
    const saved = await env.DB.prepare('INSERT INTO products (id,data) VALUES (?,?) ON CONFLICT(id) DO NOTHING')
      .bind(draft.id,JSON.stringify(draft)).run();
    added += Number(saved.meta.changes);
  }
  const received = Math.min(limit,page.result.length);
  const next = offset + received;
  const more = received > 0 && (Number.isSafeInteger(page.paging?.total) ? next < page.paging.total : received === limit);
  return json({added,failed,next:more ? next : null,total:page.paging?.total ?? null});
}

async function validatePrintfulVariants(env, product) {
  const connection = await activePrintful(env);
  if (!connection) return;
  if (/^pf-\d+$/.test(product.id)) {
    const result = await printful(env,'/store/products/'+product.id.slice(3),undefined,connection);
    const valid = new Map((result.sync_variants ?? []).map(importVariant).filter(Boolean).map(variant=>[variant.syncId,variant]));
    for (const variant of product.variants) {
      if (!valid.has(variant.syncId)) fail('Une variante Printful de ce produit n’est plus synchronisée.');
      variant.catalogId = valid.get(variant.syncId).catalogId;
    }
    return;
  }
  for (const variant of product.variants) {
    const result = await printful(env,'/store/variants/'+variant.syncId,undefined,connection);
    const valid = importVariant(result.sync_variant ?? result);
    if (!valid) fail('Une variante Printful est introuvable ou non synchronisée.');
    variant.catalogId = valid.catalogId;
  }
}

async function catalogJobStatus(env) {
  const row = await env.DB.prepare(
    'SELECT next_offset, last_attempt_at, last_success_at, last_complete_at, last_complete_failed, last_status FROM printful_catalog_job WHERE id=1'
  ).first();
  return {configured:Boolean(env.TSU_CATALOG_CRON_SECRET?.length>=32), ...row};
}

// One page per invocation keeps retries small. The lease protects the cursor
// across independent scheduler invocations and expires after an interrupted run.
async function scheduledPrintfulCatalog(request, env) {
  if (!['GET','POST'].includes(request.method)) return json({error:'Méthode refusée.'},405);
  const expected = env.TSU_CATALOG_CRON_SECRET;
  const header = request.headers.get('authorization') ?? '';
  if (!expected || expected.length<32 || !header.startsWith('Bearer ') || header.length>520) {
    return json({error:'Authentification requise.'},401);
  }
  const [actualHash, expectedHash] = await Promise.all([sha256(header.slice(7)),sha256(expected)]);
  if (!equalHash(actualHash,expectedHash)) return json({error:'Authentification requise.'},401);
  const lease = crypto.randomUUID();
  const now = epoch();
  const job = await env.DB.prepare(
    "UPDATE printful_catalog_job SET lease_id=?,lease_until=?,last_attempt_at=?,last_status='running' WHERE id=1 AND lease_until<=? RETURNING next_offset,cycle_failed"
  ).bind(lease,now+90,now,now).first();
  if (!job) return json({state:'busy'},202);
  try {
    const receipts = customerEmailReady(env) ? await retryWithdrawalReceipts(env,2) : null;
    const page = await (await importPrintfulPage(env,job.next_offset)).json();
    const completed = page.next === null;
    const cycleFailed = job.cycle_failed + page.failed;
    const status = (completed ? cycleFailed : page.failed) ? 'partial' : 'ok';
    const finished = epoch();
    await env.DB.prepare(
      'UPDATE printful_catalog_job SET next_offset=?,lease_id=NULL,lease_until=0,last_success_at=?,last_status=?, '+
      'cycle_failed=?, last_complete_failed=CASE WHEN ? THEN ? ELSE last_complete_failed END, '+
      'last_complete_at=CASE WHEN ? THEN ? ELSE last_complete_at END WHERE id=1 AND lease_id=?'
    ).bind(page.next??0,finished,status,completed ? 0 : cycleFailed,Number(completed),cycleFailed,Number(completed),finished,lease).run();
    return json({state:status,completed,cycleFailed,receipts,...page});
  } catch (error) {
    await env.DB.prepare(
      "UPDATE printful_catalog_job SET lease_id=NULL,lease_until=0,last_status='error' WHERE id=1 AND lease_id=?"
    ).bind(lease).run();
    throw error;
  }
}
