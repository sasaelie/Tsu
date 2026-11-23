const get = id => document.getElementById(id);
const form = get('product-form');
const settingsForm = get('settings-form');
const profileForm = get('profile-form');
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
async function run(button, action) {
  if (button) button.disabled = true;
  notice('');
  try { await action(); } catch (error) { notice(error.message,'error'); }
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
    const category = {tee:'T-shirts',acc:'Accessoires'}[product.type];
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
  if(!editions.length) list.append(element('p','Aucune édition hebdomadaire pour le moment.'));
  for(const edition of editions){
    const entry=element('p',edition.week+' · '+(edition.publishedAt?'Publiée':'Brouillon')+' · '+edition.items.length+' sortie(s) ');
    if(edition.publishedAt){
      const link=element('a','Lire');
      link.href='/blog/veille-'+edition.week;
      entry.append(link);
    } else entry.append(button('Relire et modifier',()=>editJournal(edition)));
    list.append(entry);
  }
  const results=await Promise.allSettled([refreshWatch(editions),refreshArticles(),api('deepseek').then(showDeepseek)]);
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
function editArticle(article={}) {
  articleForm.reset();
  articleForm.dataset.existing=String(Boolean(article.slug));
  articleForm.elements.slug.disabled=Boolean(article.slug);
  for (const field of ['slug',...articleFields]) articleForm.elements[field].value=article[field]??'';
  articleForm.hidden=false;
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
    const {configured,drafts,runs}=await api('journal/watch');
    const latest=runs[0];
    feedback(status,latest?new Date(latest.checked_at).toLocaleString('fr-BE',{timeZone:'Europe/Brussels'})+
      ' · '+latest.count+' sorties retenues'+(latest.sources.some(source=>!source.ok)?' · Certaines sources étaient indisponibles.':''):
      configured?'En attente du premier passage.':'Connexion Supabase à configurer.',latest?.count?'success':'neutral');
    list.replaceChildren();
    for (const draft of drafts.filter(draft=>!editions.some(edition=>edition.week===draft.week))) {
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
let aiConnected=false;
function showDeepseek(state) {
  aiConnected=state.connected;
  aiConfig.elements.model.value=state.model;
  aiRequest.querySelector('[type="submit"]').disabled=!aiConnected;
  feedback(get('ai-status'),aiConnected?'DeepSeek connecté.':'DeepSeek à connecter.',aiConnected?'success':'neutral');
}
aiConfig.onsubmit=e=>{
  e.preventDefault();
  const {key,model}=Object.fromEntries(new FormData(aiConfig));
  return run(e.submitter,async()=>{
    const state=await api('deepseek',{key,model});
    aiConfig.elements.key.value='';
    showDeepseek(state);
  });
};
aiRequest.onsubmit=e=>{
  e.preventDefault();
  if (!aiConnected) return;
  aiProposal=null;
  get('ai-apply').hidden=true;
  get('ai-result').hidden=true;
  const data=Object.fromEntries(new FormData(aiRequest));
  if (!articleForm.hidden && ['edit','seo'].includes(data.action)) {
    data.draft=Object.fromEntries(articleFields.map(field=>[field,articleForm.elements[field].value]));
  }
  return run(e.submitter,async()=>{
    const proposal=await api('deepseek/generate',data);
    const output=get('ai-result');
    output.textContent=proposal.analysis??Object.values(proposal.fields).filter(Boolean).join('\n\n');
    output.hidden=false;
    aiProposal=proposal.fields??null;
    get('ai-apply').hidden=!aiProposal;
  });
};
get('ai-apply').onclick=()=>{
  if (!aiProposal) return;
  if (articleForm.hidden) editArticle();
  for (const [field,value] of Object.entries(aiProposal)) {
    if (value) articleForm.elements[field].value=value;
  }
  aiProposal=null;
  get('ai-apply').hidden=true;
  articleForm.elements.titleFr.focus();
  notice('Proposition copiée dans le formulaire. Relis-la avant d’enregistrer.','success');
};
