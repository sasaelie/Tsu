const storefrontPaths = {
  '/':'home', '/collections/t-shirts':'tee', '/collections/accessoires':'acc',
  '/contact':'contact', '/mentions-legales':'legal', '/livraison-retours':'shipping',
  '/conditions-de-vente':'terms', '/confidentialite':'privacy'
};
const englishPaths = {
  '/en':'/', '/en/collections/t-shirts':'/collections/t-shirts', '/en/collections/accessories':'/collections/accessoires',
  '/en/contact':'/contact', '/en/legal-notice':'/mentions-legales', '/en/shipping-and-returns':'/livraison-retours',
  '/en/terms-of-sale':'/conditions-de-vente', '/en/privacy':'/confidentialite'
};
const marketNames = {BE:['Belgique','Belgium'],FR:['France','France']};
const htmlEscape = value=>String(value ?? '').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const jsonScript = value=>JSON.stringify(value).replace(/</g,'\\u003c');
const storefrontMoney = (amount, en)=>new Intl.NumberFormat(en?'en-IE':'fr-BE',{style:'currency',currency:'EUR'}).format(amount/100);
const local = (en, fr, english)=>en ? english : fr;
const languagePath = (path, en)=>en
  ? (path.startsWith('/produits/') ? path.replace('/produits/','/en/products/') : Object.keys(englishPaths).find(key=>englishPaths[key]===path) ?? '/en')
  : path;
const productPath = product=>{
  const slug = product.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'article';
  return '/produits/'+product.id+'/'+slug;
};
const typeName = (type,en)=>type==='tee' ? 'T-shirts' : local(en,'Accessoires','Accessories');
const collectionPath = type=>type==='tee' ? '/collections/t-shirts' : '/collections/accessoires';
function storefrontRoute(path) {
  if (Object.hasOwn(storefrontPaths,path)) return {path,en:false};
  if (Object.hasOwn(englishPaths,path)) return {path:englishPaths[path],en:true};
  const match = /^(\/en\/products|\/produits)\/([a-z0-9-]{1,40})(?:\/([a-z0-9-]+))?$/.exec(path);
  return match ? {path,en:match[1]==='/en/products',id:match[2]} : null;
}
const countriesLabel = (settings,en)=>new Intl.ListFormat(en?'en':'fr').format(settings.countries.map(code=>marketNames[code]?.[Number(en)]).filter(Boolean));

function safePhoto(value) {
  try {
    const url = new URL(value);
    return url.protocol==='https:' && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}
function shopPicture(product, detail = false) {
  const image = safePhoto(product.image);
  const loading = detail ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"';
  return image
    ? '<div class="picture product-photo"><img '+loading+' src="'+htmlEscape(image)+'" alt="'+htmlEscape(product.name)+'"></div>'
    : '<div class="picture product-placeholder" aria-hidden="true">TSŪ</div>';
}

function cards(items,en) {
  return items.length ? '<div class="shop-grid">'+items.map(product=>
    '<a class="card shop-card" href="'+languagePath(productPath(product),en)+'">'+shopPicture(product)+
    '<span><strong>'+htmlEscape(product.name)+'</strong><small>'+storefrontMoney(product.price,en)+'</small></span></a>'
  ).join('')+'</div>' : '<p>'+local(en,'Aucun article dans cette collection pour le moment.','There are no products in this collection yet.')+'</p>';
}
function navLink(path,en,fr,english) {
  return '<a href="'+languagePath(path,en)+'">'+local(en,fr,english)+'</a>';
}
function storefrontHeader(path,settings,en) {
  return '<div class="bar">'+local(en,'Impression à la demande','Print on demand')+' · '+htmlEscape(countriesLabel(settings,en))+'</div>'+
    '<header class="site-header"><a class="brand" href="'+languagePath('/',en)+'" aria-label="TSŪ">TSŪ<span aria-hidden="true">✷</span></a>'+
    '<nav aria-label="'+local(en,'Collections','Collections')+'">'+navLink('/collections/t-shirts',en,'T-shirts','T-shirts')+navLink('/collections/accessoires',en,'Accessoires','Accessories')+'</nav>'+
    '<div class="actions"><a class="account-link" href="/compte">'+local(en,'Mon compte','My account')+'</a>'+
    '<a class="language-link" hreflang="'+local(en,'en','fr')+'" href="'+languagePath(path,!en)+'" aria-label="'+local(en,'English','Français')+'">'+local(en,'EN','FR')+'</a>'+
    '<button id="basket" type="button">'+local(en,'Panier','Cart')+' <b id="count">0</b></button></div></header>';
}
function contactLinks(profile) {
  const email = profile.publicEmail;
  const phone = profile.phone;
  return [
    email && '<a href="mailto:'+htmlEscape(email)+'">'+htmlEscape(email)+'</a>',
    phone && '<a href="tel:'+htmlEscape(phone.replace(/[^+0-9]/g,''))+'">'+htmlEscape(phone)+'</a>'
  ].filter(Boolean).join('');
}
function storefrontFooter(profile,en) {
  return '<footer class="shop-footer"><div><a class="brand" href="'+languagePath('/',en)+'">TSŪ<span aria-hidden="true">✷</span></a>'+
    (profile.businessName ? '<p>'+htmlEscape(profile.businessName)+'</p>' : '')+contactLinks(profile)+'</div>'+
    '<nav aria-label="'+local(en,'Informations boutique','Store information')+'">'+
    navLink('/contact',en,'Contact','Contact')+navLink('/mentions-legales',en,'Mentions légales','Legal notice')+
    navLink('/livraison-retours',en,'Livraison et retours','Shipping and returns')+
    navLink('/conditions-de-vente',en,'Conditions de vente','Terms of sale')+navLink('/confidentialite',en,'Confidentialité','Privacy')+
    '</nav></footer>';
}
function homeContent(items,settings,en) {
  const tag = settings[en?'tagEn':'tagFr'] || local(en,'Pour ceux qui savent.','For those who know.');
  const pitch = settings[en?'pitchEn':'pitchFr'] || local(en,'T-shirts et accessoires inspirés du manga et du folklore japonais.','T-shirts and accessories inspired by manga and Japanese folklore.');
  const featured = items.filter(product=>product.featured);
  const selection = (featured.length ? featured : items).slice(0,8);
  const collections = ['tee','acc'].map(type=>{
    const count = items.filter(product=>product.type===type).length;
    const description = type==='tee' ? local(en,'Des coupes classiques et oversize, des motifs à reconnaître au premier regard.','Classic and oversized fits with designs you can spot at a glance.')
      : local(en,'Casquettes, bobs et autres pièces pour glisser un clin d’œil manga dans ta tenue.','Caps, bucket hats and more to bring a manga reference into your day.');
    return '<a class="collection-tile" href="'+languagePath(collectionPath(type),en)+'"><h3>'+typeName(type,en)+'</h3><p>'+description+'</p>'+
      '<span>'+ (count ? count+' '+local(en,count===1?'article':'articles',count===1?'item':'items') : local(en,'Voir la collection','Explore the collection'))+'</span></a>';
  }).join('');
  return '<section class="hero"><div class="intro"><span class="label">'+local(en,'Le vestiaire otaku','The otaku wardrobe')+
    '</span><h1>TSŪ<span>!</span></h1><p class="tag">'+htmlEscape(tag)+'</p><p class="pitch">'+htmlEscape(pitch)+'</p>'+
    '<a href="#collections" class="primary">'+local(en,'Voir les collections','Shop the collections')+'</a></div>'+
    '<div class="scene"><img src="/room.webp" width="1536" height="1024" alt="" fetchpriority="high"><span aria-hidden="true" class="sticker star">✷</span><span aria-hidden="true" class="sticker manga">ドン!</span><span aria-hidden="true" class="sticker heart">♥</span></div></section>'+
    '<section id="collections" class="shop-section"><h2>'+local(en,'Les collections','The collections')+'</h2><div class="collection-grid">'+collections+'</div></section>'+
    '<section id="collection" class="shop-section"><h2>'+local(en,featured.length?'À la une':'Dans la boutique',featured.length?'Featured':'In the shop')+'</h2>'+
    cards(selection,en)+'</section>'+
    '<section class="shop-section about-shop"><h2>'+local(en,'L’univers TSŪ','The world of TSŪ')+'</h2><p>'+
    local(en,'TSŪ réunit des pièces de tous les jours inspirées des mangas et du folklore japonais. Les articles sont imprimés ou brodés à la demande. La fabrication commence après la commande, puis le colis est expédié.',
      'TSŪ brings together everyday pieces inspired by manga and Japanese folklore. Items are printed or embroidered on demand. Production begins after an order is placed, then the parcel is shipped.')+'</p><p>'+
    navLink('/livraison-retours',en,'Voir les délais, les frais et les retours','See delivery times, prices and returns')+'</p></section>';
}
function productContent(product,settings,en) {
  const variantName = variant=>[variant.size,variant.color].filter(Boolean).join(' · ') || variant.label || local(en,'Variante unique','One option');
  const descriptions = product[en?'en':'fr'] || product[en?'fr':'en'];
  const facts = [
    [local(en,'Matière','Material'),product.material],
    [local(en,'Entretien','Care'),product.care],
    [local(en,'Guide des tailles','Size guide'),product.sizing],
    [local(en,'Fabricant et sécurité','Manufacturer and safety'),product.safety]
  ].filter(([,value])=>value);
  return '<div class="shop-section"><nav class="breadcrumbs" aria-label="'+local(en,'Fil d’Ariane','Breadcrumbs')+'">'+
    navLink('/',en,'Accueil','Home')+'<span aria-hidden="true">/</span>'+
    navLink(collectionPath(product.type),en,typeName(product.type,false),typeName(product.type,true))+'</nav>'+
    '<article class="product-page"><div class="product-art">'+shopPicture(product,true)+'</div><div class="product-info">'+
    '<h1>'+htmlEscape(product.name)+'</h1><p class="product-price">'+storefrontMoney(product.price,en)+'</p>'+
    (descriptions ? '<p class="preserve-lines">'+htmlEscape(descriptions)+'</p>' : '')+
    '<form id="product-actions" data-product="'+htmlEscape(product.id)+'">'+
    '<label>'+local(en,'Variante','Variant')+' <select name="variant" required>'+product.variants.map(variant=>
      '<option value="'+htmlEscape(variant.id)+'">'+htmlEscape(variantName(variant))+'</option>').join('')+'</select></label>'+
    '<label>'+local(en,'Quantité','Quantity')+' <input type="number" name="quantity" min="1" max="20" value="1" required></label>'+
    '<div class="purchase-buttons"><button class="primary" type="submit" value="buy">'+local(en,'Acheter maintenant','Buy now')+'</button>'+
    '<button type="submit" value="cart">'+local(en,'Ajouter au panier','Add to cart')+'</button></div>'+
    '<p id="product-feedback" class="action-feedback" role="status"></p></form>'+
    '<p>'+local(en,'Fabriqué à la demande · Livraison vers','Made to order · Shipping to')+' '+htmlEscape(countriesLabel(settings,en))+'. '+
    navLink('/livraison-retours',en,'Voir les délais et les retours','See delivery and returns')+'</p>'+
    (facts.length ? '<dl class="product-facts">'+facts.map(([label,value])=>'<dt>'+label+'</dt><dd class="preserve-lines">'+htmlEscape(value)+'</dd>').join('')+'</dl>' : '')+
    '</div></article></div>';
}

function shippingContent(settings,profile,en) {
  const rules = settings.countries.map(code=>{
    const rule = profile.shipping?.[code];
    return '<tr><th scope="row">'+htmlEscape(marketNames[code]?.[Number(en)])+'</th><td>'+
      (rule ? storefrontMoney(rule.fee,en) : local(en,'À confirmer','To be confirmed'))+'</td><td>'+
      (rule ? rule.min+'–'+rule.max+' '+local(en,'jours ouvrables','business days') : local(en,'À confirmer','To be confirmed'))+'</td></tr>';
  }).join('');
  const preview = profile.shippingPreview ? '<p><strong>'+local(en,'Tarifs provisoires de test','Provisional test rates')+'</strong></p>' : '';
  return preview+'<p>'+local(en,'Chaque article est fabriqué après la commande. Printful indique habituellement 2 à 5 jours ouvrables de production, auxquels s’ajoute le transport. Les délais du tableau couvrent la fabrication et le transport.',
    'Each item is made after you order. Printful typically estimates 2–5 business days for production, plus transit time. The times in the table cover production and transit.')+'</p>'+
    '<div class="table-wrap"><table><thead><tr><th scope="col">'+local(en,'Destination','Destination')+'</th><th scope="col">'+local(en,'Livraison standard','Standard shipping')+
    '</th><th scope="col">'+local(en,'Délai total estimé','Estimated total time')+'</th></tr></thead><tbody>'+rules+'</tbody></table></div>'+
    '<h2>'+local(en,'Suivi et problème de livraison','Tracking and delivery issues')+'</h2><p>'+
    local(en,'Si ton colis est en retard, perdu, endommagé ou si l’article reçu diffère de ta commande, contacte la boutique avec ton numéro de commande. Une photo du produit ou de l’emballage peut aider à traiter un défaut.',
      'If your parcel is late, lost or damaged, or if you received the wrong item, contact the shop with your order number. A picture of the item or package can help us handle a defect.')+' '+navLink('/contact',en,'Contacter TSŪ','Contact TSŪ')+'</p>'+
    '<h2>'+local(en,'Retours et droit de rétractation','Returns and right of withdrawal')+'</h2><p>'+
    local(en,'Pour les produits du catalogue vendus à distance, le délai de rétractation est en principe de 14 jours calendrier à compter de la réception. La fabrication à la demande, à elle seule, ne supprime pas ce droit. Un article réellement personnalisé selon tes instructions peut relever d’une exception, qui doit être annoncée avant l’achat.',
      'For catalogue items sold at a distance, the withdrawal period is generally 14 calendar days from receipt. Making a product to order does not by itself remove this right. An item genuinely customised to your instructions may qualify for an exception, which must be disclosed before purchase.')+'</p><p>'+
    local(en,'Pour exercer ton droit, adresse une déclaration claire au vendeur, par exemple « Je vous notifie ma rétractation pour la commande [numéro], reçue le [date]. Nom et adresse : [coordonnées]. » Consulte les conditions de vente pour les modalités et frais de retour.',
      'To exercise your right, send the seller a clear statement, for example: “I hereby withdraw from order [number], received on [date]. Name and address: [details].” See the terms of sale for return instructions and costs.')+'</p>'+
    (profile.returnAddress ? '<p><strong>'+local(en,'Adresse de retour','Return address')+'</strong><br><span class="preserve-lines">'+htmlEscape(profile.returnAddress)+'</span></p>' : '')+
    '<p>'+navLink('/conditions-de-vente',en,'Consulter les conditions de vente','Read the terms of sale')+'</p>';
}

function infoPage(key,settings,profile,en) {
  if (key==='shipping') return shippingContent(settings,profile,en);
  if (key==='contact') return '<p>'+local(en,'Pour une question sur un produit, une livraison ou un retour, contacte la boutique. Pour une commande en cours, indique son numéro.',
    'For help with a product, a delivery or a return, contact the shop. For an existing order, include your order number.')+'</p>'+
    (contactLinks(profile) ? '<div class="contact-links">'+contactLinks(profile)+'</div>' : '<p>'+local(en,'Coordonnées en cours de configuration.','Contact details are being configured.')+'</p>')+
    (profile.businessAddress ? '<address class="preserve-lines">'+htmlEscape(profile.businessAddress)+'</address>' : '');
  if (key==='legal') {
    const entries = [
      [local(en,'Vendeur','Seller'),profile.businessName],
      [local(en,'Adresse professionnelle','Business address'),profile.businessAddress],
      [local(en,'Numéro d’entreprise','Company registration number'),profile.businessNumber],
      [local(en,'Numéro de TVA','VAT number'),profile.vatNumber]
    ].filter(([,value])=>value);
    return (entries.length ? '<dl>'+entries.map(([label,value])=>'<dt>'+label+'</dt><dd class="preserve-lines">'+htmlEscape(value)+'</dd>').join('')+'</dl>' : '<p>'+
      local(en,'Les informations du vendeur sont en cours de configuration.','Seller details are being configured.')+'</p>')+
      '<div class="contact-links">'+contactLinks(profile)+'</div><p>'+local(en,'Hébergement de la préproduction : ChatGPT Sites (OpenAI).','Preview hosting: ChatGPT Sites (OpenAI).')+'</p>'+
      (profile.disputeInfo ? '<h2>'+local(en,'Règlement des litiges','Dispute resolution')+'</h2><p class="preserve-lines">'+htmlEscape(profile.disputeInfo)+'</p>' : '');
  }
  const prefix = key==='terms' ? 'terms' : 'privacy';
  const value = profile[prefix+(en?'En':'Fr')] || profile[prefix+'Fr'];
  return value ? '<div class="preserve-lines"'+(en && !profile[prefix+'En']?' lang="fr"':'')+'>'+htmlEscape(value)+'</div>' :
    '<p>'+local(en,'Cette page est en cours de préparation pour le lancement de la boutique.','This page is being prepared for the shop launch.')+'</p>'+
    (key==='terms' ? '<p>'+navLink('/livraison-retours',en,'Consulter la livraison et les retours','Read the shipping and returns information')+'</p>' : '');
}

async function renderStorefront(request,env) {
  const {pathname, origin, searchParams} = new URL(request.url);
  const checkoutReturn = searchParams.has('checkout_session');
  const indexable = env.TSU_INDEXABLE === 'true' && !checkoutReturn;
  const headers = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':checkoutReturn ? 'no-referrer' : 'strict-origin-when-cross-origin'};
  if (!indexable) headers['X-Robots-Tag'] = 'noindex, nofollow';
  if (pathname==='/robots.txt') {
    const rules = indexable ? 'User-agent: *\nDisallow: /admin\nDisallow: /compte\nDisallow: /api/\nSitemap: '+origin+'/sitemap.xml\n' :
      'User-agent: *\nDisallow: /\n';
    return new Response(rules,{headers:{...headers,'Content-Type':'text/plain; charset=utf-8'}});
  }
  const published = (await products(env)).filter(product=>product.published).sort((a,b)=>Number(b.featured)-Number(a.featured));
  if (pathname==='/sitemap.xml') {
    const pages = ['/', '/collections/t-shirts','/collections/accessoires',...published.map(productPath)];
    const urls = pages.flatMap(path=>[path,languagePath(path,true)]).map(path=>'<url><loc>'+htmlEscape(origin+path)+'</loc></url>').join('');
    return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls+'</urlset>',{
      headers:{...headers,'Content-Type':'application/xml; charset=utf-8'}
    });
  }
  const route = storefrontRoute(pathname);
  const {en} = route;
  const [settings,profile] = await Promise.all([storefront(env),shopProfile(env)]);
  const product = route.id ? published.find(item=>item.id===route.id) : null;
  const page = route.id ? (product ? 'product' : 'missing') : storefrontPaths[route.path];
  const path = product ? productPath(product) : route.id ? '/' : route.path;
  if (product && pathname !== languagePath(path,en)) return Response.redirect(origin+languagePath(path,en),301);
  const titles = {
    home:local(en,'T-shirts et accessoires manga','Manga T-shirts and accessories'),tee:'T-shirts',acc:typeName('acc',en),
    contact:'Contact',legal:local(en,'Mentions légales','Legal notice'),shipping:local(en,'Livraison et retours','Shipping and returns'),
    terms:local(en,'Conditions de vente','Terms of sale'),privacy:local(en,'Confidentialité','Privacy'),
    product:product?.name,missing:local(en,'Produit introuvable','Product not found')
  };
  const heading = titles[page];
  const canonical = origin+languagePath(path,en);
  const defaults = {
    home:local(en,'TSŪ, le vestiaire otaku. T-shirts et accessoires inspirés du manga, fabriqués à la demande.','TSŪ, the otaku wardrobe. Manga-inspired T-shirts and accessories, made to order.'),
    tee:local(en,'Découvre les T-shirts manga de TSŪ, avec les coupes, couleurs et tailles disponibles pour chaque modèle.','Browse TSŪ manga T-shirts and see the fits, colours and sizes available for each design.'),
    acc:local(en,'Découvre les accessoires manga de TSŪ, des casquettes et bobs aux autres pièces de la collection.','Browse TSŪ manga accessories, including caps, bucket hats and other pieces.'),
    product:product ? product.name+' · '+typeName(product.type,en)+' · '+local(en,'Fabrication à la demande. Consulte les variantes, le prix et la livraison sur TSŪ.','Made to order. See options, pricing and delivery at TSŪ.') : ''
  };
  const description = text(product?.[en?'en':'fr'] || product?.[en?'fr':'en'] || defaults[page] ||
    heading+' · '+local(en,'Informations de la boutique TSŪ.','TSŪ store information.'),155);
  const schema = product ? {
    '@context':'https://schema.org','@type':'Product',name:product.name,
    ...(safePhoto(product.image) ? {image:safePhoto(product.image)} : {}),
    ...(product[en?'en':'fr'] || product[en?'fr':'en'] ? {description} : {}),
    ...(product.material ? {material:product.material} : {}),
    category:typeName(product.type,en),sku:product.id,url:canonical
  } : page==='home' ? {'@context':'https://schema.org','@type':'WebSite',name:'TSŪ',url:canonical,inLanguage:en?'en':'fr'} : null;
  const title = heading+' | TSŪ';
  const meta = '<title>'+htmlEscape(title)+'</title><meta name="description" content="'+htmlEscape(description)+'">'+
    ((!indexable || page==='missing') ? '<meta name="robots" content="noindex, nofollow">' : '')+
    (page==='missing' ? '' : '<link rel="canonical" href="'+htmlEscape(canonical)+'"><link rel="alternate" hreflang="fr" href="'+htmlEscape(origin+path)+'"><link rel="alternate" hreflang="en" href="'+htmlEscape(origin+languagePath(path,true))+'">')+
    '<meta property="og:title" content="'+htmlEscape(title)+'"><meta property="og:description" content="'+htmlEscape(description)+'"><meta property="og:url" content="'+htmlEscape(canonical)+'">'+
    '<meta property="og:image" content="'+htmlEscape(safePhoto(product?.image) || origin+'/room.webp')+'">'+
    (schema ? '<script type="application/ld+json">'+jsonScript(schema)+'</script>' : '');
  let main;
  if (page==='home') main = homeContent(published,settings,en);
  else if (page==='product') main = productContent(product,settings,en);
  else if (page==='tee' || page==='acc') main = '<section class="shop-section"><h1>'+heading+'</h1><p>'+
    (page==='tee' ? local(en,'Des T-shirts inspirés du manga, en coupe classique ou oversize selon le modèle.','Manga-inspired T-shirts in classic or oversized fits, depending on the design.') :
      local(en,'Casquettes, bobs et accessoires inspirés de la culture otaku.','Caps, bucket hats and accessories inspired by otaku culture.'))+'</p>'+
    cards(published.filter(item=>item.type===page),en)+'</section>';
  else main = '<article class="shop-section info-page"><h1>'+htmlEscape(heading)+'</h1>'+
    (page==='missing' ? navLink('/',en,'Retour à la boutique','Back to the store') : infoPage(page,settings,profile,en))+'</article>';
  const client = {
    language:en?'en':'fr',checkoutMode:await checkoutMode(env,settings,profile),liveRequested:salesEnabled(env),countries:settings.countries,
    shipping:profile.shipping ?? {},shippingPath:languagePath('/livraison-retours',en),
    products:published.map(({id,name,price,material,variants})=>({id,name,price,material,variants:variants.map(({id,size,color,label})=>({id,size,color,label}))}))
  };
  const template = new TextDecoder().decode(Uint8Array.from(atob(assets['/'][1]),char=>char.charCodeAt(0)));
  const replacements = {
    LANG:en?'en':'fr',META:meta,SKIP:local(en,'Aller au contenu','Skip to content'),
    HEADER:storefrontHeader(path,settings,en),MAIN:main,FOOTER:storefrontFooter(profile,en),DATA:jsonScript(client)
  };
  return new Response(template.replace(/\{\{([A-Z]+)\}\}/g,(_,key)=>replacements[key]),{
    status:page==='missing'?404:200,headers:{...headers,'Content-Type':'text/html; charset=utf-8'}
  });
}
