import { createCart } from './cart.js';
import { setupAnalytics } from './analytics.js';

const get = id=>document.getElementById(id);
const config = JSON.parse(get('store-data').textContent);
const english = config.language === 'en';
const t = (fr,en)=>english ? en : fr;
const amount = cents=>new Intl.NumberFormat(english?'en-IE':'fr-BE',{style:'currency',currency:'EUR'}).format(cents/100);
const modal = get('checkout');
const content = get('cartContent');
const cart = createCart(config.products,count=>{get('count').textContent=count;});
const shopMenu = document.querySelector('.shop-menu');
document.addEventListener('click',event=>{
  if (shopMenu?.open && !shopMenu.contains(event.target)) shopMenu.open=false;
});
shopMenu?.addEventListener('keydown',event=>{
  if (event.key==='Escape' && shopMenu.open) {
    shopMenu.open=false;
    shopMenu.querySelector('summary').focus();
  }
});
const pendingCartKey = 'tsu-pending-cart';
let directOrder = null;
let country = config.countries[0];
const postalCodes = {};

function element(tag, label, attrs = {}) {
  const node = document.createElement(tag);
  if (label) node.textContent = label;
  for (const [key,value] of Object.entries(attrs)) node.setAttribute(key,value);
  return node;
}
function button(label, handler, attrs = {}) {
  const node = element('button',label,{type:'button',...attrs});
  node.addEventListener('click',handler);
  return node;
}
function orderItems() {
  return directOrder ? [directOrder] : cart.items;
}
function orderLine(item,index) {
  const product = cart.product(item.id);
  const variant = product.variants.find(option=>option.id===item.variantId);
  const label = [variant.size,variant.color].filter(Boolean).join(' · ') || variant.label;
  const node = element('li',null,{class:'item'});
  const detail = element('div');
  detail.append(element('span',[item.quantity+' × '+product.name,label,amount(product.price*item.quantity)].filter(Boolean).join(' · ')));
  if (product.material) detail.append(element('small',product.material,{class:'checkout-material'}));
  node.append(detail);
  if (!directOrder) {
    const actions = element('div',null,{class:'quantity-controls'});
    for (const [delta,symbol,description] of [
      [-1,'−',t('Retirer une unité','Remove one')],
      [1,'+',t('Ajouter une unité','Add one')]
    ]) {
      const id = 'qty-'+index+'-'+delta;
      actions.append(button(symbol,()=>{
        cart.change(index,delta);
        renderCheckout();
        (get(id) || get('close-checkout')).focus();
      },{id,'aria-label':description+' · '+product.name}));
    }
    node.append(actions);
  }
  return node;
}
function checkoutSummary(items, shipping) {
  const subtotal = items.reduce((sum,item)=>sum+cart.product(item.id).price*item.quantity,0);
  const summary = element('dl',null,{class:'checkout-summary'});
  summary.append(
    element('dt',t('Sous-total','Subtotal')),element('dd',amount(subtotal)),
    element('dt',t('Livraison','Shipping')),element('dd',shipping ? amount(shipping.fee) : t('À confirmer','To be confirmed'))
  );
  if (shipping) summary.append(element('dt',t('Total','Total')),element('dd',amount(subtotal+shipping.fee)));
  return summary;
}
function deliveryControls(items,shipping) {
  const section = element('div',null,{class:'row'});
  const fallback = !config.shippingPreview && shipping?.min
    ? shipping.min+'–'+shipping.max+' '+t('jours ouvrables','business days')
    : t('Fabrication habituelle : 2 à 5 jours ouvrables, puis transport.','Typical production: 2–5 business days, plus shipping.');
  const status = element('p',fallback,{role:'status'});
  const destination = country;
  const label = element('label',t('Code postal de livraison','Shipping postal code'));
  const input = element('input',null,{type:'text',inputmode:'numeric',autocomplete:'postal-code',maxlength:'5'});
  input.value = postalCodes[destination] ?? '';
  label.append(input);
  let pendingEstimate;
  const estimate = button(t('Estimer avec Printful','Get a Printful estimate'),async()=>{
    const postalCode = input.value.trim();
    if (!(destination==='BE'?/^\d{4}$/:/^\d{5}$/).test(postalCode)) {
      status.textContent=t('Vérifie le code postal pour ce pays.','Check the postal code for this country.');
      input.focus();
      return;
    }
    const controller = new AbortController();
    pendingEstimate = controller;
    estimate.disabled=true;
    status.textContent=t('Recherche du délai…','Checking delivery dates…');
    try {
      const response = await fetch('/api/delivery/estimate',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},
        body:JSON.stringify({country:destination,postalCode,lines:items})});
      const data = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok || !data.dates) throw new Error();
      const {start,end} = data.dates;
      const format = new Intl.DateTimeFormat(english?'en-IE':'fr-BE',{day:'numeric',month:'long',timeZone:'UTC'});
      status.textContent=t('Livraison estimée par Printful : ','Estimated delivery from Printful: ')+format.formatRange(new Date(start),new Date(end));
    } catch {
      if (controller.signal.aborted) return;
      status.textContent=t('Estimation indisponible. ','Estimate unavailable. ')+fallback;
    } finally {
      if (pendingEstimate===controller) {
        pendingEstimate=null;
        estimate.disabled=false;
      }
    }
  });
  input.addEventListener('input',()=>{
    pendingEstimate?.abort();
    pendingEstimate=null;
    estimate.disabled=false;
    postalCodes[destination]=input.value;
    status.textContent=fallback;
  });
  section.append(label,estimate,status);
  return section;
}
function renderCheckout() {
  const title = directOrder ? t('Ton achat','Your purchase') : t('Ton panier','Your cart');
  content.replaceChildren(button(t('Fermer','Close'),()=>modal.close(),{id:'close-checkout',class:'close'}),element('h2',title,{id:'checkout-title'}));
  const items = orderItems();
  if (!items.length) {
    content.append(element('p',t('Ton panier est vide.','Your cart is empty.')));
    return;
  }
  const list = element('ul',null,{class:'checkout-items'});
  items.forEach((item,index)=>list.append(orderLine(item,index)));
  const label = element('label',t('Pays de livraison','Shipping country'),{class:'row'});
  const select = element('select',null,{id:'country'});
  for (const code of config.countries) select.append(element('option',code==='BE'?t('Belgique','Belgium'):'France',{value:code}));
  select.value = country;
  select.addEventListener('change',()=>{
    country=select.value;
    renderCheckout();
    get('country').focus();
  });
  label.append(select);
  const shipping = config.shipping[country];
  const result = element('p',null,{class:'action-feedback',role:'status',id:'checkout-result'});
  const link = element('a',t('Livraison et retours','Shipping and returns'),{href:config.shippingPath});
  content.append(list,label,checkoutSummary(items,shipping),deliveryControls(items,shipping),link);
  if (!config.liveRequested) content.append(element('p',t('Préproduction · Aucun paiement réel','Preview · No real payments')));
  if (config.checkoutMode && shipping) {
    const label = config.checkoutMode === 'live' ? t('Continuer vers le paiement','Continue to payment') :
      t('Continuer vers le paiement test','Continue to test payment');
    content.append(button(label,event=>pay(event.currentTarget,items,result),{class:'primary checkout-action'}));
  } else {
    const reason = shipping ? t('Le paiement est momentanément indisponible.','Payment is temporarily unavailable.') :
      t('Les frais et délais de livraison de ce pays restent à configurer.','Shipping prices and times for this country are awaiting setup.');
    content.append(element('p',reason));
  }
  content.append(result);
}
async function pay(control,items,result) {
  control.disabled=true;
  result.textContent='';
  try {
    const response = await fetch('/api/checkout',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({country,lines:items,language:config.language,direct:Boolean(directOrder),postalCode:postalCodes[country]})
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    if (!directOrder) {
      try { sessionStorage.setItem(pendingCartKey,JSON.stringify({sessionId:data.sessionId,items})); } catch {}
    }
    measureCart('begin_checkout',items);
    location.assign(data.url);
  } catch (error) {
    result.textContent = error.message;
    result.dataset.tone='error';
    control.disabled=false;
  }
}
const analytics=setupAnalytics(config.analytics);
function measuredItems(lines) {
  return lines.flatMap(line=>{
    const product=cart.product(line.id);
    if (!product) return [];
    return [{item_id:product.id,item_name:product.name,item_variant:line.variantId,price:product.price/100,quantity:line.quantity}];
  });
}
function measureCart(event,lines) {
  const items=measuredItems(lines);
  if (items.length) analytics.track(event,{items,currency:'EUR',
    value:items.reduce((sum,item)=>sum+Math.round(item.price*100)*item.quantity,0)/100});
}
if (/^\/(?:en\/)?blog(?:\/|$)/.test(location.pathname)) document.addEventListener('click',event=>{
  const link=event.target.closest?.('a[href]');
  if (!link || link.origin!==location.origin) return;
  if (/^\/(?:boutique|collections|produits|en\/(?:shop|collections|products))(?:\/|$)/.test(link.pathname)) {
    analytics.track('journal_to_shop',{destination_path:link.pathname});
  }
});
function openCheckout(item = null) {
  directOrder = item;
  renderCheckout();
  modal.showModal();
}
get('basket').addEventListener('click',()=>openCheckout());
const productForm = get('product-actions');
if (productForm) analytics.onStart(()=>measureCart('view_item',[{id:productForm.dataset.product,variantId:productForm.elements.variant.value,quantity:1}]));
if (productForm) productForm.addEventListener('submit',event=>{
  event.preventDefault();
  const {variant,quantity} = Object.fromEntries(new FormData(productForm));
  const item = {id:productForm.dataset.product,variantId:variant,quantity:Number(quantity)};
  if (event.submitter?.value==='buy') {
    openCheckout(item);
  } else if (cart.add(item.id,item.variantId,item.quantity)) {
    measureCart('add_to_cart',[item]);
    get('product-feedback').textContent=t('Ajouté au panier.','Added to your cart.');
    get('product-feedback').dataset.tone='success';
  }
});
function clearPurchasedCart(sessionId) {
  try {
    const pending = JSON.parse(sessionStorage.getItem(pendingCartKey));
    if (pending?.sessionId === sessionId && Array.isArray(pending.items)) {
      sessionStorage.removeItem(pendingCartKey);
      cart.removePurchased(pending.items);
    }
  } catch {}
}

async function showCheckoutResult(sessionId, panel) {
  panel.replaceChildren(element('h1',t('Vérification du paiement','Checking payment')));
  try {
    const response = await fetch('/api/checkout/result',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId})
    });
    if (!response.ok) throw new Error();
    const order = await response.json();
    if (order.payment === 'paid') {
      analytics.onStart(()=>analytics.purchase(order));
      clearPurchasedCart(sessionId);
      panel.replaceChildren(element('h1',order.mode === 'test'
        ? t('Paiement de test confirmé','Test payment confirmed') : t('Paiement confirmé','Payment confirmed')),
      element('p',t('Commande','Order')+' '+order.reference),
      element('p',t('Total payé','Total paid')+' · '+amount(order.total)));
      panel.dataset.tone='success';
      return;
    }
    if (['failed','expired'].includes(order.payment)) {
      panel.replaceChildren(element('h1',t('Paiement non finalisé','Payment not completed')),
        element('p',t('Tu peux retourner au panier pour réessayer.','You can return to your cart to try again.')));
      return;
    }
    panel.replaceChildren(element('h1',t('Paiement en cours de confirmation','Payment confirmation pending')),
      element('p',t('Certains moyens de paiement prennent un peu plus de temps.','Some payment methods take a little longer.')));
  } catch {
    panel.replaceChildren(element('h1',t('Statut momentanément indisponible','Status temporarily unavailable')),
      element('p',t('Vérifie à nouveau le statut avant de refaire un paiement.','Check the status again before starting another payment.')));
  }
  panel.append(button(t('Vérifier le statut','Check status'),()=>showCheckoutResult(sessionId,panel)));
}

const checkoutParams = new URLSearchParams(location.search);
const returnedSession = checkoutParams.get('checkout_session');
const receiptSession = returnedSession ?? history.state?.checkoutSession;
if (receiptSession) {
  if (returnedSession) {
    checkoutParams.delete('checkout_session');
    const query = checkoutParams.toString();
    history.replaceState({...history.state,checkoutSession:returnedSession},'',location.pathname+(query ? '?'+query : '')+location.hash);
  }
  const panel = element('section',null,{class:'shop-section info-page',role:'status','aria-live':'polite'});
  get('main').replaceChildren(panel);
  showCheckoutResult(receiptSession,panel);
} else if (checkoutParams.get('checkout')==='cancelled') {
  const message=element('p',t('Paiement interrompu. Tu peux reprendre ton achat.','Payment interrupted. You can resume your purchase.'),{class:'test-return',role:'status'});
  get('main').prepend(message);
} else if (checkoutParams.get('test')==='retour') {
  const message=element('p',t('Retour de Stripe en mode test. Le statut du paiement se vérifie dans l’administration.','Returned from Stripe test mode. Check payment status in the administration panel.'),{class:'test-return',role:'status'});
  get('main').prepend(message);
}

// Keep the promotion out of checkout and show it at most once per week.
const promo = get('tsu-promo');
if (promo) {
  const promoKey='tsu-journal-promo';
  const interval=7*24*60*60*1000;
  promo.querySelector('button').onclick=()=>{promo.hidden=true;};
  document.addEventListener('keydown',event=>{if (event.key==='Escape' && !promo.hidden) promo.hidden=true;});
  get('basket').addEventListener('click',()=>{promo.hidden=true;});
  new MutationObserver(()=>{if(modal.open) promo.hidden=true;}).observe(modal,{attributes:true,attributeFilter:['open']});
  setTimeout(()=>{
    if(modal.open || document.visibilityState!=='visible') return;
    try {
      if(Date.now()-Number(localStorage.getItem(promoKey))<interval) return;
      localStorage.setItem(promoKey,String(Date.now()));
      promo.hidden=false;
    } catch {}
  },9000);
}
