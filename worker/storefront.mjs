const catalogDepartments = {
  tee: {
    path:'/collections/t-shirts', enPath:'/en/collections/t-shirts', fr:'T-shirts', en:'T-shirts',
    descFr:'Des T-shirts manga, en coupe classique ou oversize selon le modèle.',
    descEn:'Manga-inspired T-shirts in classic or oversized fits, depending on the design.'
  },
  sweat: {
    path:'/collections/pulls-sweats', enPath:'/en/collections/sweatshirts', fr:'Pulls et sweats', en:'Sweatshirts and hoodies',
    descFr:'Des pulls et sweats inspirés du manga et de la culture otaku.',
    descEn:'Sweatshirts and hoodies inspired by manga and otaku culture.'
  },
  acc: {
    path:'/collections/accessoires', enPath:'/en/collections/accessories', fr:'Accessoires', en:'Accessories',
    descFr:'Casquettes, bobs et accessoires inspirés de la culture otaku.',
    descEn:'Caps, bucket hats and accessories inspired by otaku culture.'
  }
};
const catalogTypes = Object.keys(catalogDepartments);
const catalogPath = '/boutique';
const storefrontPaths = {
  '/':'home', [catalogPath]:'catalog',
  ...Object.fromEntries(catalogTypes.map(type=>[catalogDepartments[type].path,type])),
  '/contact':'contact', '/mentions-legales':'legal', '/livraison-retours':'shipping',
  '/conditions-de-vente':'terms', '/confidentialite':'privacy'
};
const englishPaths = {
  '/en':'/', '/en/shop':catalogPath,
  ...Object.fromEntries(Object.values(catalogDepartments).map(({enPath,path})=>[enPath,path])),
  '/en/contact':'/contact', '/en/legal-notice':'/mentions-legales', '/en/shipping-and-returns':'/livraison-retours',
  '/en/terms-of-sale':'/conditions-de-vente', '/en/privacy':'/confidentialite'
};
const marketNames = {BE:['Belgique','Belgium'],FR:['France','France']};
const htmlEscape = value=>String(value ?? '').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const jsonScript = value=>JSON.stringify(value).replace(/</g,'\\u003c');
const storefrontMoney = (amount, en)=>new Intl.NumberFormat(en?'en-IE':'fr-BE',{style:'currency',currency:'EUR'}).format(amount/100);
const local = (en, fr, english)=>en ? english : fr;
const languagePath = (path, en)=>en
  ? (path.startsWith('/produits/') ? path.replace('/produits/','/en/products/') :
    editorialEnglishPath(path) || Object.keys(englishPaths).find(key=>englishPaths[key]===path) || '/en')
  : path;
const productPath = product=>{
  const slug = product.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'article';
  return '/produits/'+product.id+'/'+slug;
};
const typeName = (type,en)=>catalogDepartments[type]?.[en?'en':'fr'] ?? '';
const availableDepartments = items=>catalogTypes.filter(type=>items.some(item=>item.type===type));
function storefrontRoute(path) {
  const editorial = editorialRoute(path);
  if (editorial) return editorial;
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
function catalogLinks(types,path,en) {
  const departments = types.map(type=>catalogDepartments[type]);
  const links = [{path:catalogPath,fr:'Tout voir',en:'Shop all'},...departments];
  return '<ul>'+links.map(item=>'<li><a href="'+languagePath(item.path,en)+'"'+
    (path===item.path?' aria-current="page"':'')+'>'+item[en?'en':'fr']+'</a></li>').join('')+'</ul>';
}

function storefrontHeader(path,settings,en,departments) {
  return '<div class="bar">'+local(en,'Impression à la demande','Print on demand')+' · '+htmlEscape(countriesLabel(settings,en))+'</div>'+
    '<header class="site-header"><a class="brand" href="'+languagePath('/',en)+'" aria-label="TSŪ">TSŪ<span aria-hidden="true">✷</span></a>'+
    '<nav aria-label="'+local(en,'Navigation principale','Main navigation')+'">'+
    navLink('/',en,'Accueil','Home')+'<details class="shop-menu"><summary>'+local(en,'Boutique','Shop')+'</summary>'+
    catalogLinks(departments,path,en)+'</details>'+navLink('/blog',en,'Journal','Journal')+'</nav>'+
    '<div class="actions"><a class="account-link" href="'+local(en,'/espace-client','/en/account')+'">'+local(en,'Espace client','Customer account')+'</a>'+
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
function storefrontFooter(profile,en,hasAnalytics) {
  return '<footer class="shop-footer"><div><a class="brand" href="'+languagePath('/',en)+'">TSŪ<span aria-hidden="true">✷</span></a>'+
    (profile.businessName ? '<p>'+htmlEscape(profile.businessName)+'</p>' : '')+contactLinks(profile)+'</div>'+
    '<nav aria-label="'+local(en,'Informations boutique','Store information')+'">'+
    navLink('/contact',en,'Contact','Contact')+navLink('/mentions-legales',en,'Mentions légales','Legal notice')+
    navLink('/livraison-retours',en,'Livraison et retours','Shipping and returns')+
    navLink('/conditions-de-vente',en,'Conditions de vente','Terms of sale')+navLink('/confidentialite',en,'Confidentialité','Privacy')+
    navLink('/a-propos',en,'À propos de TSŪ','About TSŪ')+navLink('/faq',en,'FAQ','FAQ')+
    '<a href="'+local(en,'/espace-client','/en/account')+'#newsletter">Newsletter</a>'+
    (hasAnalytics?'<button id="analytics-settings" type="button">'+local(en,'Préférences de statistiques','Statistics preferences')+'</button>':'')+
    '</nav></footer>';
}
function homeContent(items,settings,en,member) {
  const tag = settings[en?'tagEn':'tagFr'] || local(en,'Pour ceux qui savent.','For those who know.');
  const pitch = settings[en?'pitchEn':'pitchFr'] || local(en,'T-shirts et accessoires inspirés du manga et du folklore japonais.','T-shirts and accessories inspired by manga and Japanese folklore.');
  const publicItems = items.filter(product=>canViewProduct(product,false));
  const featured = publicItems.filter(product=>product.featured);
  const selection = (featured.length ? featured : publicItems).slice(0,8);
  const memberItems = member ? items.filter(product=>!canViewProduct(product,false)) : [];
  const collections = availableDepartments(items).map(type=>{
    const count = items.filter(product=>product.type===type).length;
    const department = catalogDepartments[type];
    return '<a class="collection-tile" href="'+languagePath(department.path,en)+'"><h3>'+typeName(type,en)+'</h3><p>'+
      local(en,department.descFr,department.descEn)+'</p><span>'+count+' '+local(en,count===1?'article':'articles',count===1?'item':'items')+'</span></a>';
  }).join('');
  return '<section class="hero"><div class="intro"><span class="label">'+local(en,'Le vestiaire otaku','The otaku wardrobe')+
    '</span><h1>TSŪ<span>!</span></h1><p class="tag">'+htmlEscape(tag)+'</p><p class="pitch">'+htmlEscape(pitch)+'</p>'+
    '<a href="'+languagePath(catalogPath,en)+'" class="primary">'+local(en,'Voir la boutique','Visit the shop')+'</a></div>'+
    '<div class="scene"><img src="/room.webp" width="1536" height="1024" alt="" fetchpriority="high"><span aria-hidden="true" class="sticker star">✷</span><span aria-hidden="true" class="sticker manga">ドン!</span><span aria-hidden="true" class="sticker heart">♥</span></div></section>'+
    (collections ? '<section id="collections" class="shop-section"><h2>'+local(en,'Les rayons','Departments')+'</h2><div class="collection-grid">'+collections+'</div></section>' : '')+
    '<section id="collection" class="shop-section"><h2>'+local(en,featured.length?'À la une':'Dans la boutique',featured.length?'Featured':'In the shop')+'</h2>'+
    cards(selection,en)+'</section>'+
    '<section class="shop-section about-shop"><h2>'+local(en,'Les sorties en avant-première','Early access to new drops')+'</h2><p>'+
    local(en,'Inscris-toi à la newsletter pour découvrir les prochains designs et les pièces réservées aux abonnés.','Join the newsletter for early previews and subscriber-only designs.')+'</p>'+
    '<a class="primary" href="'+local(en,'/espace-client','/en/account')+'#newsletter">'+local(en,'Gérer mon inscription','Manage my subscription')+'</a></section>'+
    (member ? '<section class="shop-section" id="member-designs"><h2>'+local(en,'Les designs abonnés','Subscriber designs')+'</h2>'+cards(memberItems,en)+'</section>' : '')+
    '<section class="shop-section about-shop"><h2>'+local(en,'L’univers TSŪ','The world of TSŪ')+'</h2><p>'+
    local(en,'TSŪ réunit des pièces de tous les jours inspirées des mangas et du folklore japonais. Les articles sont imprimés ou brodés à la demande. La fabrication commence après la commande, puis le colis est expédié.',
      'TSŪ brings together everyday pieces inspired by manga and Japanese folklore. Items are printed or embroidered on demand. Production begins after an order is placed, then the parcel is shipped.')+'</p><p>'+
    navLink('/a-propos',en,'Découvrir l’histoire de TSŪ','Discover the TSŪ story')+' · '+
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
    navLink(catalogPath,en,'Boutique','Shop')+'<span aria-hidden="true">›</span>'+
    navLink(catalogDepartments[product.type].path,en,typeName(product.type,false),typeName(product.type,true))+
    '<span aria-hidden="true">›</span><span aria-current="page">'+htmlEscape(product.name)+'</span></nav>'+
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
      (rule?.min ? rule.min+'–'+rule.max+' '+local(en,'jours ouvrables','business days') : local(en,'Estimation selon le panier et le code postal','Estimated from your cart and postal code'))+'</td></tr>';
  }).join('');
  const preview = profile.shippingPreview ? '<p><strong>'+local(en,'Tarifs provisoires de test','Provisional test rates')+'</strong></p>' : '';
  return preview+'<p>'+local(en,'Chaque article est fabriqué après la commande. Printful indique habituellement 2 à 5 jours ouvrables de production, auxquels s’ajoute le transport. Dans le panier, entre ton code postal pour obtenir une estimation Printful pour tes articles.',
    'Each item is made after you order. Printful typically estimates 2–5 business days for production, plus transit time. Enter your postal code in the cart for a Printful estimate for your items.')+'</p>'+
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
  const analyticsTest=searchParams.get('analytics_test')==='1';
  const indexable = env.TSU_INDEXABLE === 'true' && !checkoutReturn && !analyticsTest;
  const headers = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':checkoutReturn ? 'no-referrer' : 'strict-origin-when-cross-origin'};
  if (!indexable) headers['X-Robots-Tag'] = 'noindex, nofollow';
  if (pathname==='/robots.txt') {
    const rules = indexable ? 'User-agent: *\nDisallow: /admin\nDisallow: /compte\nDisallow: /espace-client\nDisallow: /en/account\nDisallow: /api/\nSitemap: '+origin+'/sitemap.xml\n' :
      'User-agent: *\nDisallow: /\n';
    return new Response(rules,{headers:{...headers,'Content-Type':'text/plain; charset=utf-8'}});
  }
  if (pathname===journalFeedPath(false) || pathname===journalFeedPath(true)) return journalRSS(origin,pathname===journalFeedPath(true),env,headers);
  const all = await products(env);
  const publiclyAvailable = all.filter(product=>canViewProduct(product,false));
  if (pathname==='/sitemap.xml') {
    const [manual,weekly,articles]=await Promise.all([listEditions(env,true),syndicatedJournal(env),journalArticles(env,true)]);
    const editions=combineEditions(manual,weekly);
    const publicDepartments = availableDepartments(publiclyAvailable);
    const emptyPaths = new Set(catalogTypes.filter(type=>!publicDepartments.includes(type)).map(type=>catalogDepartments[type].path));
    const pages = [...Object.keys(storefrontPaths).filter(path=>!emptyPaths.has(path)),...Object.keys(editorialPages),...journal.map(item=>'/blog/'+item.slug),
      ...editions.flatMap(edition=>[editionPath(edition.week),...(edition.focus?[focusPath(edition.week)]:[])]),...publiclyAvailable.map(productPath)];
    const articleUrls=articles.flatMap(article=>{
      const path=journalArticlePath(article.slug);
      return article.titleEn && article.bodyEn ? [path,languagePath(path,true)] : [path];
    });
    const urls = [...pages.flatMap(path=>[path,languagePath(path,true)]),...articleUrls].map(path=>'<url><loc>'+htmlEscape(origin+path)+'</loc></url>').join('');
    return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls+'</urlset>',{
      headers:{...headers,'Content-Type':'application/xml; charset=utf-8'}
    });
  }
  const route = storefrontRoute(pathname);
  const member = newsletterAccess(await customerSession(request,env),env);
  const published = (member ? all.filter(product=>canViewProduct(product,true)) : publiclyAvailable)
    .sort((a,b)=>Number(b.featured)-Number(a.featured));
  const {en} = route;
  const departments = availableDepartments(published);
  const [manualEdition,weeklyEdition]=route.week
    ? await Promise.all([getEdition(env,route.week,true),syndicatedJournal(env,route.week)]) : [];
  const edition=route.page==='focus' ? (weeklyEdition?.focus ? weeklyEdition : null) :
    manualEdition ? {...weeklyEdition,...manualEdition} : weeklyEdition;
  const managedArticle=route.slug && route.page==='managed-article' ? await journalArticle(env,route.slug) : null;
  if (managedArticle && en && (!managedArticle.titleEn || !managedArticle.bodyEn)) return Response.redirect(origin+route.path,302);
  const [settings,profile,measurement] = await Promise.all([storefront(env),shopProfile(env),analyticsSettings(env)]);
  const product = route.id ? published.find(item=>item.id===route.id) : null;
  if (product && !canViewProduct(product,false)) headers['X-Robots-Tag'] = 'noindex, nofollow';
  const page = route.id ? (product ? 'product' : 'missing') : (route.week&&!edition || route.page==='managed-article'&&!managedArticle) ? 'missing' : route.page ?? storefrontPaths[route.path];
  const path = product ? productPath(product) : route.id ? '/' : route.path;
  if (product && pathname !== languagePath(path,en)) return Response.redirect(origin+languagePath(path,en),301);
  const titles = {
    home:local(en,'T-shirts et accessoires manga','Manga T-shirts and accessories'),catalog:local(en,'Boutique','Shop'),
    ...Object.fromEntries(catalogTypes.map(type=>[type,typeName(type,en)])),
    contact:'Contact',legal:local(en,'Mentions légales','Legal notice'),shipping:local(en,'Livraison et retours','Shipping and returns'),
    terms:local(en,'Conditions de vente','Terms of sale'),privacy:local(en,'Confidentialité','Privacy'),
    product:product?.name,missing:local(en,'Produit introuvable','Product not found')
  };
  const heading = page==='missing' ? titles.missing : (page==='focus' ? focusTitle(edition.focus,en) : null) || (managedArticle && local(en,managedArticle.titleFr,managedArticle.titleEn)) || route.title || titles[page];
  const canonical = origin+languagePath(path,en);
  const defaults = {
    home:local(en,'TSŪ, le vestiaire otaku. T-shirts et accessoires inspirés du manga, fabriqués à la demande.','TSŪ, the otaku wardrobe. Manga-inspired T-shirts and accessories, made to order.'),
    focus:edition?.focus ? focusDescription(edition.focus,en) : '',
    edition:edition ? local(en,'Mangas VF et anime de la semaine du ','French manga and anime releases for the week of ')+mangaDate(edition.week,en)+local(en,' avec les dates et leurs sources.',' with dates and source links.') : '',
    catalog:local(en,'Explore le vestiaire otaku TSŪ. Retrouve tous les modèles disponibles et les rayons de la boutique.','Explore the TSŪ otaku wardrobe. Browse available designs and shop departments.'),
    ...Object.fromEntries(catalogTypes.map(type=>[type,local(en,catalogDepartments[type].descFr,catalogDepartments[type].descEn)])),
    product:product ? product.name+' · '+typeName(product.type,en)+' · '+local(en,'Fabrication à la demande. Consulte les variantes, le prix et la livraison sur TSŪ.','Made to order. See options, pricing and delivery at TSŪ.') : ''
  };
  const description = text((managedArticle && (local(en,managedArticle.seoFr,managedArticle.seoEn) || local(en,managedArticle.bodyFr,managedArticle.bodyEn))) || local(en,route.descFr,route.descEn) || product?.[en?'en':'fr'] || product?.[en?'fr':'en'] || defaults[page] ||
    heading+' · '+local(en,'Informations de la boutique TSŪ.','TSŪ store information.'),155);
  const journalImage = page==='article' ? staticArticleImage(route.article) :
    ['blog','edition','focus'].includes(page) ? journalImages.watch : null;
  const imageUrl=safePhoto(product?.image) || origin+(journalImage?.path ?? '/room.webp');
  const schema = product ? {
    '@context':'https://schema.org','@type':'Product',name:product.name,
    ...(safePhoto(product.image) ? {image:safePhoto(product.image)} : {}),
    ...(product[en?'en':'fr'] || product[en?'fr':'en'] ? {description} : {}),
    ...(product.material ? {material:product.material} : {}),
    category:typeName(product.type,en),sku:product.id,url:canonical
  } : ['article','edition','focus','managed-article'].includes(page) ? {'@context':'https://schema.org','@type':'BlogPosting',headline:heading,description,url:canonical,
    datePublished:(managedArticle ?? edition)?.publishedAt.slice(0,10) ?? '2026-11-23',
    ...(page==='article' ? {dateModified:editorialRevision} : {}),
    ...(journalImage ? {image:[imageUrl]} : {}),
    mainEntityOfPage:canonical,inLanguage:en?'en':'fr',
    author:{'@type':'Organization',name:local(en,'La rédaction TSŪ','TSŪ editorial team'),url:origin+languagePath('/a-propos',en)}} :
    page==='home' ? {'@context':'https://schema.org','@type':'WebSite',name:'TSŪ',url:canonical,inLanguage:en?'en':'fr'} : null;
  const journalCrumbs = ['article','managed-article','edition','focus','archive'].includes(page);
  const breadcrumbsSchema = journalCrumbs ? {'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[
    {'@type':'ListItem',position:1,name:local(en,'Journal manga et anime','Manga and anime journal'),item:origin+languagePath('/blog',en)},
    {'@type':'ListItem',position:2,name:heading,item:canonical}
  ]} : null;
  const title = heading+' | TSŪ';
  const verification=page==='home' && measurement.searchConsole
    ? '<meta name="google-site-verification" content="'+htmlEscape(measurement.searchConsole)+'">' : '';
  const meta = verification+'<title>'+htmlEscape(title)+'</title><meta name="description" content="'+htmlEscape(description)+'">'+
    ((!indexable || page==='missing') ? '<meta name="robots" content="noindex, nofollow">' : '')+
    (page==='missing' ? '' : '<link rel="canonical" href="'+htmlEscape(canonical)+'"><link rel="alternate" hreflang="fr" href="'+htmlEscape(origin+path)+'">'+(managedArticle && (!managedArticle.titleEn || !managedArticle.bodyEn) ? '' : '<link rel="alternate" hreflang="en" href="'+htmlEscape(origin+languagePath(path,true))+'">'))+
    '<link rel="alternate" type="application/rss+xml" title="Journal TSŪ" href="'+journalFeedPath(en)+'">'+
    '<meta property="og:title" content="'+htmlEscape(title)+'"><meta property="og:description" content="'+htmlEscape(description)+'"><meta property="og:url" content="'+htmlEscape(canonical)+'">'+
    '<meta property="og:image" content="'+htmlEscape(imageUrl)+'">'+
    [schema,breadcrumbsSchema].filter(Boolean).map(data=>'<script type="application/ld+json">'+jsonScript(data)+'</script>').join('');
  const journalTrail=journalCrumbs ? '<nav class="breadcrumbs" aria-label="'+local(en,'Fil d’Ariane','Breadcrumbs')+'">'+
    navLink('/blog',en,'Journal','Journal')+'<span aria-hidden="true">›</span><span aria-current="page">'+htmlEscape(heading)+'</span></nav>' : '';
  let main;
  if (page==='home') main = homeContent(published,settings,en,member)+(!checkoutReturn ? editorialPromo(en) : '');
  else if (page==='product') main = productContent(product,settings,en);
  else if (page==='managed-article') main = '<article class="shop-section info-page editorial">'+journalTrail+'<h1>'+htmlEscape(heading)+'</h1><div class="preserve-lines">'+
    htmlEscape(local(en,managedArticle.bodyFr,managedArticle.bodyEn))+'</div><p class="editorial-signature" lang="fr">Tu n’auras pas vu mon site pour rien.</p></article>';
  else if (['about','faq','blog','article','archive','edition','focus'].includes(page)) {
    const [manual,weekly,articles]=['blog','archive'].includes(page)
      ? await Promise.all([listEditions(env,true),syndicatedJournal(env),journalArticles(env,true)]) : [[],[],[]];
    const editions=combineEditions(manual,weekly);
    const articleList=articles.length ? '<ul class="release-list">'+articles.map(article=>'<li>'+
      navLink(journalArticlePath(article.slug),Boolean(en && article.titleEn && article.bodyEn),htmlEscape(article.titleFr),htmlEscape(article.titleEn))+'</li>').join('')+'</ul>' : '';
    const content = page==='about' ? aboutEditorial(en) : page==='faq' ? faqEditorial(en) :
      page==='blog' ? articleList+journalEditorial(en,editions)+editorialSponsor(env,en) :
        page==='archive' ? articleList+editionList(editions,en)+focusList(editions,en)+'<p>'+navLink('/blog/5-mangas-novembre-2026',en,'Sélection de novembre 2026','November 2026 selection')+'</p>' :
        page==='edition' ? editionEditorial(edition,en) : page==='focus' ? focusArticle(edition,en) : articleEditorial(route.article,en);
    main = '<'+(page==='blog'?'section':'article')+' class="shop-section info-page editorial">'+journalTrail+'<h1>'+htmlEscape(heading)+'</h1>'+
      content+'</'+(page==='blog'?'section':'article')+'>';
  }
  else if (page==='catalog' || catalogTypes.includes(page)) {
    const items = page==='catalog' ? published : published.filter(item=>item.type===page);
    main = '<section class="shop-section"><h1>'+htmlEscape(heading)+'</h1><p>'+htmlEscape(description)+'</p>'+
      '<nav class="catalog-nav" aria-label="'+local(en,'Rayons de la boutique','Shop departments')+'">'+
      catalogLinks(departments,path,en)+'</nav>'+cards(items,en)+'</section>';
  }
  else main = '<article class="shop-section info-page"><h1>'+htmlEscape(heading)+'</h1>'+
    (page==='missing' ? navLink('/',en,'Retour à la boutique','Back to the store') : infoPage(page,settings,profile,en))+
    (page==='privacy' && (measurement.productionId || measurement.testId) ?
      '<h2>'+local(en,'Mesure d’audience','Audience measurement')+'</h2><p>'+
      local(en,'Avec ton consentement, Google Analytics mesure les visites, les clics vers la boutique et les étapes d’achat. Tu peux retirer ton consentement dans « Préférences de statistiques » en bas du site.',
        'With your consent, Google Analytics measures visits, clicks to the shop and shopping activity. You can withdraw consent under “Statistics preferences” at the bottom of the site.')+'</p>' : '')+
    '</article>';
  const paymentMode=await checkoutMode(env,settings,profile);
  const analyticsMode=env.TSU_INDEXABLE==='true' && paymentMode!=='test'?'live':'test';
  const measurementId=analyticsMode==='live'?measurement.productionId:measurement.testId;
  const analytics=gaMeasurementPattern.test(measurementId??'')?{id:measurementId,mode:analyticsMode,path:languagePath(path,en)}:null;
  if (page==='home' && analyticsTest && analytics?.mode==='test' && !checkoutReturn &&
      await ownerSession(request,env,request.headers.get('oai-authenticated-user-id'))) {
    main=analyticsTestControls(en)+main;
  }
  const client = {
    analytics,language:en?'en':'fr',checkoutMode:paymentMode,liveRequested:salesEnabled(env),countries:settings.countries,
    shipping:profile.shipping ?? {},shippingPreview:Boolean(profile.shippingPreview),shippingPath:languagePath('/livraison-retours',en),
    products:published.map(({id,name,price,material,variants})=>({id,name,price,material,variants:variants.map(({id,size,color,label})=>({id,size,color,label}))}))
  };
  const template = new TextDecoder().decode(Uint8Array.from(atob(assets['/'][1]),char=>char.charCodeAt(0)));
  const replacements = {
    LANG:en?'en':'fr',META:meta,SKIP:local(en,'Aller au contenu','Skip to content'),
    HEADER:storefrontHeader(path,settings,en,departments),MAIN:main,FOOTER:storefrontFooter(profile,en,Boolean(analytics)),CONSENT:analytics?analyticsControls(en):'',DATA:jsonScript(client)
  };
  return new Response(template.replace(/\{\{([A-Z]+)\}\}/g,(_,key)=>replacements[key]),{
    status:page==='missing'?404:200,headers:{...headers,'Content-Type':'text/html; charset=utf-8'}
  });
}
