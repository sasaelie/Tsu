const get = id => document.getElementById(id);
const form = get('product-form');
const settingsForm = get('settings-form');
let state;
let syncing = false;
const euro = cents => new Intl.NumberFormat('fr-BE',{style:'currency',currency:'EUR'}).format(cents/100);
const notice = message => { get('notice').textContent = message; };

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
  try { await action(); } catch (error) { notice(error.message); }
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
  for (const key of ['id','name','image','fr','en']) form.elements[key].value = product[key] ?? '';
  form.elements.type.value = product.type ?? 'tee';
  form.elements.price.value = product.price ? (product.price/100).toFixed(2) : '';
  for (const key of ['published','featured']) form.elements[key].checked = Boolean(product[key]);
  get('variants').replaceChildren();
  const variants = product.variants?.length ? product.variants : [{}];
  variants.forEach(variantRow);
  form.hidden = false;
  form.elements.name.focus();
}
function renderOrders() {
  get('connections').textContent =
    (state.stripe ? 'Stripe en mode test connecté' : 'Stripe en mode test à connecter')+' · '+
    (state.printful ? 'Printful connecté' : 'Printful à connecter')+
    '. La synchronisation crée uniquement un brouillon Printful.';
  const list = get('order-list');
  list.replaceChildren();
  if (!state.orders.length) list.append(element('p','Aucune commande de test pour le moment.'));
  for (const order of state.orders) {
    const row = element('div',null,'record');
    const details = element('div');
    const payments = { paid:'Payée en test', unpaid:'En attente de paiement', expired:'Session expirée' };
    details.append(element('strong',payments[order.payment] ?? order.payment),element('p',
      order.createdAt+' · '+order.country+' · Printful '+(order.printful === 'none' ? 'en attente' : order.printful)));
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
      notice(result.error || 'Commande synchronisée.');
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
        notice(product.name+' est visible dans '+category+'.');
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
    await api('products',data);
    form.hidden = true;
    await refresh();
    notice('Produit enregistré.');
  });
};
settingsForm.onsubmit = event=>{
  event.preventDefault();
  const data = Object.fromEntries(new FormData(settingsForm));
  data.countries = [data.be && 'BE',data.fr && 'FR'].filter(Boolean);
  return run(event.submitter,async ()=>{
    await api('settings',data);
    notice('Boutique mise à jour.');
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
    notice('Printful connecté à '+store+'.');
  });
};
async function syncCatalog() {
  if (!state?.printful || syncing) return;
  syncing = true;
  const control = get('sync-catalog');
  const status = get('catalog-sync-status');
  control.disabled = true;
  status.textContent = 'Recherche de nouveaux produits Printful…';
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
    status.textContent = added ? added+' nouveau(x) produit(s) en brouillon.' :
      total === 0 ? 'Aucun produit disponible dans ta boutique Printful.' : 'Aucun nouveau produit à importer.';
    if (failed) status.textContent += ' '+failed+' fiche(s) n’ont pas pu être lues. Tu peux actualiser.';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    syncing = false;
    control.disabled = false;
  }
}
get('sync-catalog').onclick = syncCatalog;
tab(new URLSearchParams(location.search).get('tab') === 'printful' ? 'printful' : 'products');
run(null,async ()=>{
  await refresh();
  if (!get('products').hidden) await syncCatalog();
});
