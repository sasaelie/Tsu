const shopProfileFields = {
  businessName: 150, businessNumber: 60, vatNumber: 60, businessAddress: 350,
  publicEmail: 254, phone: 40, returnAddress: 350, disputeInfo: 1600,
  termsFr: 9000, termsEn: 9000, privacyFr: 9000, privacyEn: 9000
};

async function shopProfile(env) {
  return (await readData(env.DB,'SELECT data FROM shop_profile WHERE id = 1'))[0] ?? {shipping:{}};
}

function shippingRule(input) {
  if (!input) return null;
  const {fee, min, max} = input;
  if (![fee,min,max].every(Number.isSafeInteger) || fee < 0 || fee > 100000 || min < 1 || max < min || max > 60) {
    fail('Renseigne ensemble les frais et les délais minimum et maximum, entre 1 et 60 jours ouvrables.');
  }
  return {fee,min,max};
}

async function saveShopProfile(request, env) {
  const input = await body(request, 48_000);
  if (!input || typeof input !== 'object') fail('Informations boutique invalides.');
  const data = Object.fromEntries(Object.entries(shopProfileFields).map(([key, max])=>[key,text(input[key],max)]));
  if (data.publicEmail && !/^[^\s@<>:]+@[^\s@<>:]+\.[^\s@<>:]+$/.test(data.publicEmail)) fail('Adresse e-mail de contact invalide.');
  if (data.phone && !/^\+?[0-9().\s-]{5,40}$/.test(data.phone)) fail('Numéro de téléphone invalide.');
  data.shipping = Object.fromEntries(['BE','FR'].map(country=>[country,shippingRule(input.shipping?.[country])]));
  await env.DB.prepare('INSERT INTO shop_profile (id,data) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data')
    .bind(JSON.stringify(data)).run();
  return json(data);
}
