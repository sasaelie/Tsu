const dayMillis = 86400000;

async function deliveryDates(env, items, country, zip) {
  const config = await activePrintful(env);
  if (!config) return null;
  const variants = new Map(items.filter(item=>item.catalogId).map(item=>[item.syncId,item.catalogId]));
  await Promise.all([...new Set(items.map(item=>item.syncId))].filter(id=>!variants.has(id)).map(async id=>{
    const data = await printful(env,'/store/variants/'+id,undefined,config);
    const catalogId = Number(data?.sync_variant?.variant_id);
    if (Number.isSafeInteger(catalogId) && catalogId>0) variants.set(id,catalogId);
  }));
  if (items.some(item=>!variants.has(item.syncId))) return null;
  const rates = await printful(env,'/shipping/rates',{
    recipient:{country_code:country,...(zip?{zip}:{})},currency:'EUR',
    items:items.map(item=>({variant_id:variants.get(item.syncId),quantity:item.quantity}))
  },config);
  const rate = Array.isArray(rates) ? rates.find(option=>option.id==='STANDARD') : null;
  const start = rate?.minDeliveryDate;
  const end = rate?.maxDeliveryDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(end ?? '')) return null;
  const today = Date.parse(new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Brussels',dateStyle:'short'}).format());
  const min = Math.max(1,Math.ceil((Date.parse(start)-today)/dayMillis));
  const max = Math.max(min,Math.ceil((Date.parse(end)-today)/dayMillis));
  return Number.isFinite(max) && max<=60 && start<=end ? {start,end,min,max,unit:'day'} : null;
}

async function findDeliveryDates(env,items,country,zip) {
  try { return await deliveryDates(env,items,country,zip); }
  catch { return null; }
}

function deliveryZip(value,country) {
  if (typeof value!=='string' || !value.trim()) return '';
  const zip = value.trim();
  if (!(country==='BE'?/^\d{4}$/:/^\d{5}$/).test(zip)) fail('Code postal invalide pour cette destination.');
  return zip;
}

async function deliveryQuote(request,env) {
  const {country,lines,postalCode} = await body(request);
  const [config,customer] = await Promise.all([storefront(env),customerSession(request,env)]);
  const items = await checkoutItems(env,config,customer,country,lines);
  const zip = deliveryZip(postalCode,country);
  const client = request.headers.get('cf-connecting-ip') ?? customer?.id ?? 'local';
  await customerLimit(env,'delivery',client,60,900);
  return json({dates:await findDeliveryDates(env,items,country,zip)});
}
