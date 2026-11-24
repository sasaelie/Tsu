const get = id => document.getElementById(id);
const form = get('product-form');
const settingsForm = get('settings-form');
const profileForm = get('profile-form');
const analyticsForm = get('analytics-form');
let state;
let syncing = false;
const euro = cents => new Intl.NumberFormat('fr-BE',{style:'currency',currency:'EUR'}).format(cents/100);
function feedback(node, message, tone = 'neutral') {
  node.dataset.tone = tone;
  node.textContent = message;
}
const notice = (message, tone) => feedback(get('notice'),message,tone);

async function api(route = 'state', data) {
  const response = await fetch('/api/admin/'+route,data ? {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)
  } : undefined);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Requête impossible.');
  return result;
}
async function run(button, action, report=notice) {
  if (button) button.disabled = true;
  report('');
  try { await action(); } catch (error) { report(error.message,'error'); }
  finally { if (button) button.disabled = false; }
}
function element(tag, value, className) {
  const node = document.createElement(tag);
  if (value) node.textContent = value;
  if (className) node.className = className;
  return node;
}
function button(label, action) {
  const node = element('button',label);
  node.type = 'button';
  node.onclick = () => action(node);
  return node;
}
function variantRow(variant = {}) {
  const row = element('div',null,'variant');
  row.dataset.id = variant.id ?? '';
  row.dataset.label = variant.label ?? '';
  for (const [key,label,type,max] of [
    ['size','Taille','text',32],['color','Couleur','text',40],['syncId','ID de variante Printful','number',0]
  ]) {
    const field = element('label',label);
    const input = document.createElement('input');
    input.dataset.key = key;
    input.type = type;
    input.value = variant[key] || '';
    if (max) input.maxLength = max;
    else { input.min = '1'; input.step = '1'; }
    field.append(input);
    row.append(field);
  }
  row.append(button('Retirer',()=>row.remove()));
  get('variants').append(row);
}
function editProduct(product = {}) {
  form.reset();
  for (const key of ['id','name','image','fr','en','material','care','sizing','safety']) form.elements[key].value = product[key] ?? '';
  form.elements.type.value = product.type ?? 'tee';
  form.elements.price.value = product.price ? (product.price/100).toFixed(2) : '';
  form.elements.audience.value = product.audience ?? 'public';
  form.elements.releaseAt.value = product.releaseAt ? brusselsInput(new Date(product.releaseAt)) : '';
  productAudience();
  for (const key of ['published','featured']) form.elements[key].checked = Boolean(product[key]);
  get('variants').replaceChildren();
  const variants = product.variants?.length ? product.variants : [{}];
  variants.forEach(variantRow);
  form.hidden = false;
  form.elements.name.focus();
}
const brussels = new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Brussels',dateStyle:'short',timeStyle:'short'});
const brusselsInput = value => brussels.format(value).replace(' ','T');
function utcRelease(value) {
  const minute = Date.parse(value+'Z');
  for (const offset of [1,2]) {
    const date = new Date(minute-offset*3600000);
    if (Number.isFinite(date.getTime()) && brusselsInput(date)===value) return date.toISOString();
  }
  throw new Error('Cette heure de sortie n’existe pas à Bruxelles. Choisis une autre heure.');
}
function productAudience() {
  const early = form.elements.audience.value==='early';
  get('release-field').hidden=!early;
  form.elements.releaseAt.required=early;
}
function renderOrders() {
  get('stripe-settings-label').textContent = state.stripe ? 'Remplacer la clé de test Stripe' : 'Connecter Stripe en mode test';
  if (!state.stripe) get('stripe-settings').open = true;
  const ready = state.settings.countries.some(country=>state.profile?.shipping?.[country]);
  get('stripe-readiness').textContent = state.liveRequested && state.checkoutMode !== 'live'
    ? 'Vente bloquée. Vérifie les frais définitifs, la connexion Printful et les réglages Stripe réels.'
    : !state.liveRequested && state.stripe && !ready
    ? 'Renseigne les frais et les délais pour au moins un pays dans Coordonnées et livraison afin d’essayer le paiement.'
    : '';
  const stripeStatus = state.liveRequested ? (state.checkoutMode === 'live' ? 'Stripe en mode réel' : 'Stripe réel indisponible')
    : (state.stripe ? 'Stripe en mode test connecté' : 'Stripe en mode test à connecter');
  get('connections').textContent =
    stripeStatus+' · '+
    (state.printful ? 'Printful connecté' : 'Printful à connecter')+
    '. La synchronisation crée uniquement un brouillon Printful.';
  const list = get('order-list');
  list.replaceChildren();
  if (!state.orders.length) list.append(element('p','Aucune commande pour le moment.'));
  for (const order of state.orders) {
    const row = element('div',null,'record');
    const details = element('div');
    const payments = { paid:'Payée', unpaid:'En attente de paiement', expired:'Session expirée', failed:'Paiement échoué' };
    const total = order.items.reduce((sum,item)=>sum+item.price*item.quantity,0) + (order.shippingFee ?? 0);
    const printfulStatus = {none:'en attente',draft:'brouillon'};
    details.append(element('strong',(payments[order.payment] ?? order.payment)+(order.mode === 'live' ? ' · Réel' : ' · Test')),element('p',
      order.createdAt+' · '+order.country+' · '+euro(total)+' · Printful '+(printfulStatus[order.printful] ?? order.printful)));
    const lines = element('ul');
    order.items.forEach(item=>lines.append(element('li',item.quantity+' × '+item.name+' · '+euro(item.price*item.quantity))));
    details.append(lines);
    if (order.printfulId) details.append(element('p','Commande Printful '+order.printfulId));
    if (order.error) details.append(element('p',order.error));
    for (const shipment of order.shipments ?? []) {
      if (shipment.number) details.append(element('p','Suivi '+shipment.number));
    }
    row.append(details,button('Synchroniser', control=>run(control,async ()=>{
      const result = await api('orders/sync',{id:order.id});
      await refresh();
      notice(result.error || 'Commande synchronisée.',result.error ? 'error' : 'success');
    })));
    list.append(row);
  }
}
async function refresh() {
  state = await api();
  get('identity').textContent = state.email ? 'Compte propriétaire · '+state.email : 'Compte propriétaire';
  renderProducts();
  get('sync-catalog').hidden = !state.printful;
  get('catalog-sync-status').hidden = !state.printful;
  refreshSettings();
  populateProfile();
  renderOrders();
}
function renderProducts() {
  const list = get('product-list');
  list.replaceChildren();
  if (!state.products.length) list.append(element('p','Aucun produit enregistré. Le catalogue de démonstration reste disponible.'));
  for (const product of state.products) {
    const row = element('div',null,'record');
    const category = {tee:'T-shirts',sweat:'Pulls et sweats',acc:'Accessoires'}[product.type];
    const title = element('div',null,'product-summary');
    if (product.image) {
      const image = document.createElement('img');
      image.src = product.image;
      image.alt = '';
      image.loading = 'lazy';
      title.append(image);
    }
    title.append(element('strong',product.name));
    const needs = [!category && 'catégorie',!product.price && 'prix',!product.variants.length && 'variantes'].filter(Boolean);
    const ready = !needs.length && product.variants.every(variant=>variant.syncId);
    const details = element('p',[
      product.published ? 'Publié' : product.id.startsWith('pf-') ? 'Brouillon Printful' : 'Brouillon',
      category,product.price && euro(product.price),product.variants.length+' variante(s)',
      needs.length ? 'À compléter · '+needs.join(', ') : ''
    ].filter(Boolean).join(' · '));
    title.append(details);
    const controls = element('div',null,'product-actions');
    controls.append(button(product.published ? 'Modifier' : 'Vérifier la fiche',()=>editProduct(product)));
    if (product.id.startsWith('pf-') && !product.published && ready) {
      controls.append(button('Valider et publier',control=>run(control,async ()=>{
        await api('products',{...product,published:true});
        await refresh();
        notice(product.name+' est visible dans '+category+'.','success');
      })));
    }
    row.append(title,controls);
    list.append(row);
  }
}
function refreshSettings() {
  for(const key of ['tagFr','tagEn','pitchFr','pitchEn']) settingsForm.elements[key].value = state.settings[key] ?? '';
  settingsForm.elements.be.checked = state.settings.countries.includes('BE');
  settingsForm.elements.fr.checked = state.settings.countries.includes('FR');
  get('printful-status').textContent = state.printful ? 'Connecté à '+(state.printfulStore ?? 'Printful')+'.' : 'Printful à connecter.';
  get('printful-next').hidden = !state.printful;
  get('printful-credentials-label').textContent = state.printful ? 'Remplacer le jeton' : 'Configurer la connexion';
  get('printful-credentials').open = !state.printful;
  get('printful-credentials').hidden = false;
}
function tab(id) {
  document.querySelectorAll('main > section').forEach(section=>{section.hidden = section.id !== id;});
  document.querySelectorAll('[data-tab]').forEach(control=>{
    if(control.dataset.tab === id) control.setAttribute('aria-current','true');
    else control.removeAttribute('aria-current');
  });
  if (id === 'products') syncCatalog();
}
document.querySelectorAll('[data-tab]').forEach(control=>{control.onclick=()=>tab(control.dataset.tab);});
const analyticsFeedback=(message,tone)=>feedback(get('analytics-status'),message,tone);
async function loadAnalyticsSettings() {
  const data=await api('analytics');
  for (const field of ['testId','productionId','searchConsole']) analyticsForm.elements[field].value=data[field];
  analyticsForm.querySelector('button').disabled=false;
}
document.querySelector('[data-tab="settings"]').addEventListener('click',()=>{
  if (analyticsForm.querySelector('button').disabled) run(null,loadAnalyticsSettings,analyticsFeedback);
});
analyticsForm.onsubmit=event=>{
  event.preventDefault();
  return run(event.submitter,async()=>{
    await api('analytics',Object.fromEntries(new FormData(analyticsForm)));
    analyticsFeedback('Réglages Google enregistrés.','success');
  },analyticsFeedback);
};

form.elements.audience.onchange=productAudience;
get('new').onclick = ()=>editProduct();
get('add-variant').onclick = ()=>variantRow();
get('refresh-orders').onclick = event=>run(event.currentTarget,refresh);
form.onsubmit = event=>{
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  data.price = Math.round(Number(data.price)*100);
  data.published = form.elements.published.checked;
  data.featured = form.elements.featured.checked;
  data.variants = [...get('variants').children].map(row=>({
    id:row.dataset.id,label:row.dataset.label,...Object.fromEntries([...row.querySelectorAll('input')].map(input=>[input.dataset.key,input.value]))
  }));
  return run(event.submitter,async ()=>{
    if (data.audience==='early') data.releaseAt=utcRelease(data.releaseAt);
    await api('products',data);
    form.hidden = true;
    await refresh();
    notice(data.published ? 'Produit publié.' : 'Produit enregistré.','success');
  });
};
const profileKeys = [
  'businessName','businessNumber','vatNumber','businessAddress','publicEmail','phone',
  'returnAddress','disputeInfo','termsFr','termsEn','privacyFr','privacyEn'
];
function populateProfile() {
  const profile = state.profile ?? {};
  get('trial-shipping-note').hidden = !profile.shippingPreview;
  for (const key of profileKeys) profileForm.elements[key].value = profile[key] ?? '';
  for (const country of ['BE','FR']) {
    const rule = profile.shipping?.[country];
    profileForm.elements[country+'Fee'].value = rule ? (rule.fee/100).toFixed(2) : '';
    profileForm.elements[country+'Min'].value = rule?.min ?? '';
    profileForm.elements[country+'Max'].value = rule?.max ?? '';
  }
}
profileForm.onsubmit = event=>{
  event.preventDefault();
  const formData = new FormData(profileForm);
  const data = Object.fromEntries(profileKeys.map(key=>[key,formData.get(key)]));
  data.shipping = {};
  return run(event.submitter,async ()=>{
    for (const country of ['BE','FR']) {
      const [fee,min,max] = ['Fee','Min','Max'].map(key=>formData.get(country+key));
      if ([fee,min,max].every(value=>value==='')) continue;
      if ([fee,min,max].some(value=>value==='')) throw new Error('Renseigne les frais et les deux délais pour chaque destination configurée.');
      data.shipping[country] = {fee:Math.round(Number(fee)*100),min:Number(min),max:Number(max)};
    }
    state.profile = await api('profile',data);
    populateProfile();
    notice('Coordonnées et livraison mises à jour.','success');
  });
};
settingsForm.onsubmit = event=>{
  event.preventDefault();
  const data = Object.fromEntries(new FormData(settingsForm));
  data.countries = [data.be && 'BE',data.fr && 'FR'].filter(Boolean);
  return run(event.submitter,async ()=>{
    await api('settings',data);
    notice('Boutique mise à jour.','success');
  });
};
get('open-products').onclick = ()=>{
  tab('products');
  document.querySelector('[data-tab="products"]').focus();
};
get('printful-form').onsubmit = event=>{
  event.preventDefault();
  const form = event.currentTarget;
  return run(event.submitter,async ()=>{
    const {store} = await api('printful',{token:form.elements.token.value});
    form.reset();
    await refresh();
    notice('Printful connecté à '+store+'.','success');
  });
};
async function syncCatalog() {
  if (!state?.printful || syncing) return;
  syncing = true;
  const control = get('sync-catalog');
  const status = get('catalog-sync-status');
  control.disabled = true;
  feedback(status,'Recherche de nouveaux produits Printful…');
  let added = 0;
  let failed = 0;
  let total;
  try {
    let offset = 0;
    do {
      const result = await api('printful/import',{offset});
      added += result.added;
      failed += result.failed;
      total = result.total ?? total;
      offset = result.next;
    } while (offset !== null);
    const latest = await api();
    state.products = latest.products;
    renderProducts();
    const summary = added ? added+' nouveau(x) produit(s) en brouillon.' :
      total === 0 ? 'Aucun produit disponible dans ta boutique Printful.' : 'Aucun nouveau produit à importer.';
    const details = failed ? ' '+failed+' fiche(s) n’ont pas pu être lues. Tu peux actualiser.' : '';
    feedback(status,summary+details,failed ? 'error' : added ? 'success' : 'neutral');
  } catch (error) {
    feedback(status,error.message,'error');
  } finally {
    syncing = false;
    control.disabled = false;
  }
}
get('sync-catalog').onclick = syncCatalog;
get('stripe-form').onsubmit = async event=>{
  event.preventDefault();
  const form = event.currentTarget;
  const button = event.submitter;
  const result = get('stripe-result');
  button.disabled = true;
  let saved = false;
  feedback(result,'Vérification en cours…');
  try {
    await api('stripe',{key:form.elements.key.value});
    form.reset();
    feedback(result,'Stripe est connecté en mode test.','success');
    saved = true;
    await refresh();
  } catch (error) {
    form.elements.key.focus({preventScroll:true});
    feedback(result,saved
      ? 'Clé enregistrée. Actualise la page pour voir le statut.'
      : error.message,saved ? 'success' : 'error');
  } finally {
    button.disabled = false;
  }
};
async function showSupport(openTicket) {
  const data = await api('customers');
  get('newsletter-summary').textContent = data.count+' inscription(s) confirmée(s).'+
    (data.emailReady ? '' : ' L’expéditeur e-mail reste à configurer.');
  const announcement = get('announcement-form');
  const eligible = (state?.products ?? []).filter(product=>product.published && ['early','newsletter'].includes(product.audience));
  const select = announcement.elements.productId;
  const previous = select.value;
  select.replaceChildren(...eligible.map(product=>new Option(product.name,product.id)));
  if (eligible.some(product=>product.id===previous)) select.value=previous;
  announcement.hidden = !data.emailReady || !data.count || !eligible.length;
  const list = get('support-list');
  list.replaceChildren();
  if (!data.tickets.length) list.append(element('p','Aucun ticket client.'));
  for (const ticket of data.tickets) {
    const entry = element('details',null,'record');
    entry.open=ticket.id===openTicket;
    entry.append(element('summary',ticket.subject+' · '+(ticket.status==='open'?'Ouvert':'Fermé')),element('p',ticket.email));
    if (ticket.order_id) entry.append(element('p','Commande '+ticket.order_id));
    for (const message of ticket.messages) {
      const line=element('p',message.message);
      line.style.whiteSpace='pre-wrap';
      entry.append(element('strong',message.sender==='shop'?'TSŪ':'Client'),line);
    }
    if (ticket.status==='open') {
      const reply=element('form');
      const label=element('label','Réponse');
      const field=element('textarea'); field.required=true; field.maxLength=4000;
      label.append(field);
      const submit=element('button','Envoyer la réponse');
      reply.append(label,submit);
      reply.onsubmit=event=>{
        event.preventDefault();
        run(submit,async()=>{await api('tickets/reply',{id:ticket.id,message:field.value}); await showSupport(ticket.id); notice('Réponse envoyée.','success');});
      };
      entry.append(reply);
    }
    entry.append(button(ticket.status==='open'?'Fermer le ticket':'Rouvrir le ticket',control=>run(control,async()=>{
      await api('tickets/status',{id:ticket.id,status:ticket.status==='open'?'closed':'open'});
      await showSupport(ticket.id);
      notice('Ticket mis à jour.','success');
    })));
    list.append(entry);
  }
}
get('announcement-form').onsubmit=event=>{
  event.preventDefault();
  const productId=event.currentTarget.elements.productId.value;
  if (!productId || !window.confirm('Envoyer l’annonce aux abonnés confirmés de TSŪ ?')) return;
  run(event.submitter,async()=>{
    const status=get('announcement-status');
    let sent=0;
    let result;
    do {
      result=await api('newsletter/send',{productId});
      sent+=result.sent;
      status.textContent=sent+' annonce(s) acceptée(s) par le service e-mail.';
    } while (result.remaining && result.sent && !result.failed);
    if (result.failed) status.textContent+=' '+result.failed+' envoi(s) à réessayer.';
    if (result.review) status.textContent+=' '+result.review+' envoi(s) ancien(s) à vérifier dans Resend.';
  });
};
get('refresh-customers').onclick=event=>run(event.currentTarget,showSupport);
document.querySelector('[data-tab="customers"]').addEventListener('click',()=>run(null,showSupport));
const initialTab = new URLSearchParams(location.search).get('tab');
tab(['products','settings','profile','printful','orders','customers','journal'].includes(initialTab) ? initialTab : 'products');
run(null,async ()=>{
  await refresh();
  if (!get('products').hidden) await syncCatalog();
  if (!get('customers').hidden) await showSupport();
  if (!get('journal').hidden) await refreshJournal();
  if (!get('settings').hidden) await run(null,loadAnalyticsSettings,analyticsFeedback);
});

const journalForm=get('journal-form');
const journalRows=get('journal-items');
function addJournalItem(data={}) {
  if(journalRows.children.length>=10) return;
  const row=element('fieldset');
  row.append(element('legend','Sortie'));
  for(const [name,label,type] of [
    ['kind','Type','select'],['title','Titre','text'],['date','Date','date'],['source','Lien de la source','url'],
    ['noteFr','Note française','textarea'],['noteEn','Note anglaise','textarea']
  ]){
    const field=element(type==='textarea'||type==='select'?type:'input');
    if(type!=='textarea'&&type!=='select') field.type=type;
    if(type==='select') field.append(new Option('Manga','manga'),new Option('Anime','anime'));
    field.name=name;
    field.required=!name.startsWith('note');
    field.value=data[name]??(name==='kind'?'manga':'');
    if(type==='textarea') field.maxLength=550;
    const wrapper=element('label',label);
    wrapper.append(field);
    row.append(wrapper);
  }
  row.append(button('Retirer cette sortie',()=>row.remove()));
  journalRows.append(row);
}
function editJournal(edition={}) {
  journalForm.reset();
  for(const key of ['week','introFr','introEn']) journalForm.elements[key].value=edition[key]??'';
  journalRows.replaceChildren();
  for(const row of edition.items??[]) addJournalItem(row);
  journalForm.hidden=false;
  journalForm.elements.week.focus();
}
async function refreshJournal(){
  const {editions}=await api('journal');
  const list=get('journal-editions');
  list.replaceChildren();
  if(!editions.length) list.append(element('p','Aucune édition créée manuellement pour le moment.'));
  for(const edition of editions){
    const entry=element('p',edition.week+' · '+(edition.publishedAt?'Publiée':'Brouillon')+' · '+edition.items.length+' sortie(s) ');
    if(edition.publishedAt){
      const link=element('a','Lire');
      link.href='/blog/veille-'+edition.week;
      entry.append(link);
    } else entry.append(button('Relire et modifier',()=>editJournal(edition)));
    list.append(entry);
  }
  const results=await Promise.allSettled([refreshWatch(editions),refreshArticles(),api('editorial-ai').then(showEditorialAi, error=>feedback(get('ai-status'),error.message,'error'))]);
  const failed=results.find(result=>result.status==='rejected');
  if (failed) throw failed.reason;
}
get('journal-new').onclick=()=>editJournal();
get('journal-refresh').onclick=e=>run(e.currentTarget,refreshJournal);
get('journal-add-item').onclick=()=>addJournalItem();
document.querySelector('[data-tab="journal"]').addEventListener('click',()=>run(null,refreshJournal));
journalForm.onsubmit=e=>{
  e.preventDefault();
  const publish=e.submitter.value==='publish';
  const data=Object.fromEntries(['week','introFr','introEn'].map(key=>[key,journalForm.elements[key].value]));
  data.items=Array.from(journalRows.children,row=>Object.fromEntries(Array.from(row.querySelectorAll('[name]'),field=>[field.name,field.value])));
  return run(e.submitter,async()=>{
    await api('journal/save',data);
    if(publish) await api('journal/publish',{week:data.week});
    journalForm.hidden=true;
    await refreshJournal();
    notice(publish?'Édition publiée dans le journal.':'Brouillon enregistré.','success');
  });
};

const articleForm=get('article-form');
const articleFields=['titleFr','titleEn','seoFr','seoEn','bodyFr','bodyEn'];
let aiProposal=null;
let articleVersion=0;
function editArticle(article={}) {
  articleVersion++;
  articleForm.reset();
  articleForm.dataset.existing=String(Boolean(article.slug));
  articleForm.elements.slug.disabled=Boolean(article.slug);
  for (const field of ['slug',...articleFields]) articleForm.elements[field].value=article[field]??'';
  get('article-existing-english').hidden=!['titleEn','seoEn','bodyEn'].some(field=>article[field]);
  get('article-existing-english').open=false;
  articleForm.hidden=false;
  updateEditorialDraftContext();
}
get('article-new').onclick=()=>{editArticle();articleForm.elements.slug.focus();};
async function refreshArticles() {
  const {articles}=await api('journal/articles');
  const list=get('journal-articles');
  list.replaceChildren();
  for (const article of articles) {
    const entry=element('p',article.titleFr+' · '+(article.publishedAt?'Publié':'Brouillon')+' ');
    entry.append(button('Ouvrir',()=>{editArticle(article);articleForm.elements.titleFr.focus();}));
    if (article.publishedAt) {
      const link=element('a','Voir en ligne');
      link.href='/blog/article-'+article.slug;
      entry.append(' ',link);
    }
    list.append(entry);
  }
}
articleForm.onsubmit=e=>{
  e.preventDefault();
  const publish=e.submitter.value==='publish';
  return run(e.submitter,async()=>{
    const data=Object.fromEntries(['slug',...articleFields].map(field=>[field,articleForm.elements[field].value]));
    await api('journal/articles',{...data,existing:articleForm.dataset.existing==='true',publish});
    articleForm.hidden=true;
    articleVersion++;
    updateEditorialDraftContext();
    aiProposal=null;
    get('ai-apply').hidden=true;
    await refreshArticles();
    notice(publish?'Article publié dans le Journal.':'Brouillon d’article enregistré.','success');
  });
};

async function refreshWatch(editions) {
  const status=get('watch-status');
  const list=get('watch-drafts');
  try {
    const {configured,drafts,runs,published}=await api('journal/watch');
    const latest=runs[0];
    const decisions={published:'Édition publiée automatiquement',review:'À relire avant publication','dry-run':'Contrôles réussis en mode test'};
    feedback(status,latest?new Date(latest.checked_at).toLocaleString('fr-BE',{timeZone:'Europe/Brussels'})+
      ' · '+(decisions[latest.decision]??'Collecte terminée')+' · '+latest.count+' sorties collectées':
      configured?'En attente du premier passage.':'Connexion Supabase à configurer.',
      latest?.decision==='review'?'error':latest?.count?'success':'neutral');
    list.replaceChildren();
    const problems=latest?.sources.filter(source=>!source.ok)??[];
    if (problems.length) {
      const details=element('details');
      details.append(element('summary','Résultats des vérifications'));
      const diagnostics=element('ul');
      for (const source of problems) diagnostics.append(element('li',source.name+' · '+(source.error??'Source indisponible')));
      details.append(diagnostics);
      list.append(details);
    }
    for (const item of published.slice(0,8)) {
      const entry=element('p',item.week+' · Publiée automatiquement ');
      const link=element('a','Voir l’édition');
      link.href='/blog/veille-'+item.week;
      entry.append(link);
      list.append(entry);
    }
    for (const draft of drafts.filter(draft=>![...editions,...published].some(edition=>edition.week===draft.week))) {
      const entry=element('p',draft.week+' · '+draft.contents.items.length+' sorties ');
      entry.append(button('Ouvrir le brouillon',control=>run(control,async()=>{
        const {edition}=await api('journal/watch/import',{week:draft.week});
        await refreshJournal();
        if (!edition.publishedAt) editJournal(edition);
        else notice('Cette édition est déjà publiée.','success');
      })));
      list.append(entry);
    }
  } catch(error) { feedback(status,error.message,'error'); }
}

const aiConfig=get('ai-config');
const aiRequest=get('ai-request');
const editorialActions={
  write:{
    help:'Pars d’un sujet pour obtenir un titre, un texte et une métadescription en français.',
    brief:'Sujet de l’article',example:'Exemple : expliquer comment commencer le manga Naruto',
    source:'Extraits de sources publiques (facultatif)',sourceHelp:'Pour une actualité, colle les extraits datés et leurs liens. La recherche web se fait en dehors de l’atelier.',
    sourceExample:'Exemple : date, lien et extrait du calendrier de l’éditeur',submit:'Rédiger en français'
  },
  edit:{
    help:'Améliore la clarté et le style d’un texte existant en gardant ses faits.',
    brief:'Ce que tu souhaites améliorer (facultatif)',example:'Exemple : rendre l’introduction plus directe et raccourcir les phrases',
    existing:'Texte français à réviser',submit:'Réviser le texte'
  },
  seo:{
    help:'Propose un titre et une métadescription pour les résultats de recherche.',
    brief:'Recherche visée',example:'Exemple : t-shirt manga discret en Belgique',
    existing:'Texte ou résumé de la page (facultatif)',submit:'Proposer un titre et une métadescription'
  },
  competition:{
    help:'Compare les pratiques visibles dans les extraits et propose des pistes pour TSŪ.',
    brief:'Ce que tu veux comparer (facultatif)',example:'Exemple : la présentation des collections et les descriptions produit',
    source:'Extraits des sites à comparer',sourceHelp:'Colle le nom, le lien et le passage de chaque site que tu veux comparer.',
    sourceExample:'Exemple : boutique A, lien de la page, extrait de la description',submit:'Comparer les extraits'
  },
  design:{
    help:'Obtiens des idées de visuels, de couleurs et de placement pour les produits TSŪ.',
    brief:'Produit, thème et style souhaités',example:'Exemple : sweat noir, symbole original sur la manche, palette rouge et crème',
    submit:'Proposer des idées de design'
  }
};
const editorialAnswers=get('ai-result');
const previousActionInputs={};
let currentAction;
function updateEditorialDraftContext() {
  const title=articleForm.elements.titleFr.value.trim();
  get('ai-draft-target').textContent=articleForm.hidden
    ? 'Colle un texte ici ou ouvre un article dans la liste du Journal.'
    : 'Article ouvert : '+(title||'brouillon sans titre')+'. Laisse le champ vide pour utiliser son texte.';
}
function showEditorialAction() {
  const {action,brief,sources,existingText}=aiRequest.elements;
  if (currentAction) previousActionInputs[currentAction]={brief:brief.value,sources:sources.value,existingText:existingText.value};
  currentAction=action.value;
  const options=editorialActions[currentAction];
  const cached=previousActionInputs[currentAction]??{};
  get('ai-action-help').textContent=options.help;
  get('ai-brief-label').textContent=options.brief;
  brief.placeholder=options.example;
  brief.value=cached.brief??'';
  brief.required=currentAction==='design';
  get('ai-source-fields').hidden=!options.source;
  get('ai-source-label').textContent=options.source??'';
  get('ai-source-help').textContent=options.sourceHelp??'';
  sources.disabled=!options.source;
  sources.required=currentAction==='competition';
  sources.placeholder=options.sourceExample??'';
  sources.value=cached.sources??'';
  get('ai-draft-context').hidden=!options.existing;
  get('ai-existing-label').textContent=options.existing??'';
  existingText.disabled=!options.existing;
  existingText.value=cached.existingText??'';
  updateEditorialDraftContext();
  get('ai-request-submit').textContent=options.submit;
  aiProposal=null;
  editorialAnswers.hidden=true;
  get('ai-apply').hidden=true;
  feedback(get('ai-request-status'),'');
}
aiRequest.elements.action.onchange=showEditorialAction;
articleForm.elements.titleFr.addEventListener('input',updateEditorialDraftContext);
showEditorialAction();

const aiChat=get('ai-chat');
const chatForm=get('ai-chat-form');
const chatContent=get('ai-chat-content');
let chatProvider;
let chatHistory=[];
let aiState=null;
const articleFieldLabels={
  titleFr:'Titre français',titleEn:'Titre anglais',seoFr:'Métadescription française',seoEn:'Métadescription anglaise',
  bodyFr:'Texte français',bodyEn:'Texte anglais'
};
function setEditorialModels(provider,selectedModel) {
  aiConfig.elements.model.replaceChildren(...provider.models.map(model=>new Option(model.name,model.id)));
  if (selectedModel) aiConfig.elements.model.value=selectedModel;
  get('ai-key-link').hidden=provider.id!=='agnes';
}
function showEditorialAi(state) {
  aiState=state;
  aiConfig.querySelector('[type="submit"]').disabled=false;
  aiConfig.elements.provider.replaceChildren(...state.providers.map(provider=>new Option(provider.name,provider.id)));
  aiConfig.elements.provider.value=state.provider;
  const provider=state.providers.find(entry=>entry.id===state.provider);
  setEditorialModels(provider,state.model);
  aiRequest.querySelector('[type="submit"]').disabled=!state.connected;
  get('ai-chat-open').disabled=!state.connected;
  get('ai-chat-open').textContent='Parler à '+provider.name;
  get('ai-chat-title').textContent='Conversation avec '+provider.name;
  if (chatProvider && chatProvider!==state.provider) {
    chatHistory=[];
    chatContent.replaceChildren();
  }
  chatProvider=state.provider;
  feedback(get('ai-status'),state.connected?provider.name+' connecté.':provider.name+' à connecter.',state.connected?'success':'neutral');
}
get('ai-chat-open').onclick=()=>{
  if (!chatForm.elements.message.value) chatForm.elements.message.value=aiRequest.elements.brief.value;
  aiChat.showModal();
  chatForm.elements.message.focus();
};
function chatMessage(label,value) {
  const entry=element('article',null,'chat-message');
  const message=element('p',value);
  entry.append(element('strong',label),message);
  chatContent.append(entry);
  chatContent.scrollTop=chatContent.scrollHeight;
  return message;
}
async function readChatReply(messages,onDelta) {
  const response=await fetch('/api/admin/editorial-ai/chat',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages})
  });
  if (!response.ok) {
    const payload=await response.json().catch(()=>null);
    throw new Error(payload?.error??'La conversation est momentanément indisponible.');
  }
  if (!response.body) throw new Error('La réponse n’a pas pu être ouverte.');
  let buffer='';
  let finish;
  const reader=response.body.pipeThrough(new TextDecoderStream()).getReader();
  try {
    while (true) {
      const {done,value}=await reader.read();
      buffer+=value??'';
      const lines=buffer.split('\n');
      buffer=lines.pop();
      if (done && buffer) lines.push(buffer);
      for (const line of lines.filter(Boolean)) {
        const event=JSON.parse(line);
        if (event.error) throw new Error(event.error);
        if (event.delta) onDelta(event.delta);
        if (event.finish) finish=event.finish;
      }
      if (done) break;
    }
  } finally {
    await reader.cancel().catch(()=>{});
    reader.releaseLock();
  }
  if (!finish) throw new Error('La réponse s’est interrompue.');
  return finish;
}
chatForm.onsubmit=e=>{
  e.preventDefault();
  const field=chatForm.elements.message;
  const question=field.value.trim();
  if (!aiState?.connected || !question) return;
  const provider=aiState.providers.find(item=>item.id===aiState.provider);
  const report=(message,tone)=>feedback(get('ai-chat-status'),message,tone);
  const sent={role:'user',content:question};
  const history=[...chatHistory.slice(-8),sent];
  return run(e.submitter,async()=>{
    field.value='';
    field.disabled=true;
    chatMessage('Toi',question);
    const answer=chatMessage(provider.name,'');
    let reply='';
    report('En attente de la réponse…','pending');
    try {
      const finish=await readChatReply(history,delta=>{
        const follow=chatContent.scrollHeight-chatContent.scrollTop-chatContent.clientHeight<36;
        if (!reply) report('Réponse en cours…','pending');
        reply+=delta;
        answer.textContent=reply;
        if (follow) chatContent.scrollTop=chatContent.scrollHeight;
      });
      if (!reply.trim()) throw new Error('La réponse reçue est vide.');
      chatHistory=[...history,{role:'assistant',content:reply.slice(0,4000)}];
      report(finish==='length'?'La réponse a atteint sa limite de longueur. Tu peux demander la suite.':'Réponse terminée.',finish==='length'?'neutral':'success');
    } catch(error) {
      if (!reply) answer.textContent='Aucun texte reçu.';
      field.value=question;
      throw error;
    } finally {
      field.disabled=false;
      if (aiChat.open) field.focus();
    }
  },report);
};
aiConfig.elements.provider.onchange=()=>{
  aiConfig.elements.key.value='';
  setEditorialModels(aiState.providers.find(entry=>entry.id===aiConfig.elements.provider.value));
};
aiConfig.onsubmit=e=>{
  e.preventDefault();
  if (!aiState) return;
  const {key,provider,model}=Object.fromEntries(new FormData(aiConfig));
  const report=(message,tone)=>feedback(get('ai-status'),message,tone);
  return run(e.submitter,async()=>{
    report('Vérification de la clé en cours…','pending');
    const state=await api('editorial-ai',{key,provider,model});
    aiConfig.elements.key.value='';
    showEditorialAi(state);
  },report);
};
aiRequest.onsubmit=e=>{
  e.preventDefault();
  if (!aiState?.connected) return;
  aiProposal=null;
  get('ai-apply').hidden=true;
  get('ai-result').hidden=true;
  const data=Object.fromEntries(new FormData(aiRequest));
  const usesOpenArticle=!articleForm.hidden && ['edit','seo'].includes(data.action) && !data.existingText?.trim();
  if (usesOpenArticle) {
    data.draft=Object.fromEntries(['titleFr','seoFr','bodyFr'].map(field=>[field,articleForm.elements[field].value]));
  }
  const targetVersion=articleForm.hidden?null:articleVersion;
  const report=(message,tone)=>feedback(get('ai-request-status'),message,tone);
  return run(e.submitter,async()=>{
    report('Génération en cours…','pending');
    aiRequest.elements.action.disabled=true;
    let proposal;
    try { proposal=await api('editorial-ai/generate',data); }
    finally { aiRequest.elements.action.disabled=false; }
    const output=get('ai-result');
    output.replaceChildren();
    if (proposal.fields) {
      for (const [field,value] of Object.entries(proposal.fields)) {
        if (value) output.append(element('strong',articleFieldLabels[field]),element('p',value));
      }
    } else if (proposal.analysis) {
      output.append(element('p',proposal.analysis));
    } else if (proposal.reply) {
      output.append(element('strong','Réponse reçue'),element('p',proposal.reply));
    }
    output.hidden=!output.childElementCount;
    aiProposal=proposal.fields ? {fields:proposal.fields,targetVersion} : null;
    get('ai-apply').textContent=data.action==='seo'?'Appliquer le titre et la métadescription':'Appliquer au brouillon';
    get('ai-apply').hidden=!aiProposal;
    report(proposal.message??'Proposition prête.',proposal.message?'neutral':'success');
  },report);
};
get('ai-apply').onclick=()=>{
  if (!aiProposal) return;
  const {fields,targetVersion}=aiProposal;
  if (targetVersion!==null && (articleForm.hidden || targetVersion!==articleVersion)) {
    feedback(get('ai-request-status'),'L’article ouvert a changé. Relance la demande pour cet article.','error');
    return;
  }
  if (articleForm.hidden) editArticle();
  for (const [field,value] of Object.entries(fields)) {
    if (value) articleForm.elements[field].value=value;
  }
  aiProposal=null;
  get('ai-apply').hidden=true;
  articleForm.elements.titleFr.focus();
  updateEditorialDraftContext();
  notice('Proposition copiée dans le formulaire. Relis-la avant d’enregistrer.','success');
};
