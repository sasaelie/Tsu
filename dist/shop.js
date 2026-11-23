import { createCart } from './cart.js';

const get = id=>document.getElementById(id);
const config = JSON.parse(get('store-data').textContent);
const english = config.language === 'en';
const t = (fr,en)=>english ? en : fr;
const amount = cents=>new Intl.NumberFormat(english?'en-IE':'fr-BE',{style:'currency',currency:'EUR'}).format(cents/100);
const modal = get('checkout');
const content = get('cartContent');
const cart = createCart(config.products,count=>{get('count').textContent=count;});
let directOrder = null;
let country = config.countries[0];

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
  if (shipping) summary.append(
    element('dt',t('Délai total estimé','Estimated total time')),element('dd',shipping.min+'–'+shipping.max+' '+t('jours ouvrables','business days')),
    element('dt',t('Total','Total')),element('dd',amount(subtotal+shipping.fee))
  );
  return summary;
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
  content.append(list,label,checkoutSummary(items,shipping),element('p',t('Préproduction · Aucun paiement réel','Preview · No real payments')),link);
  if (config.stripe && shipping) {
    content.append(button(t('Continuer vers le paiement test','Continue to test payment'),event=>pay(event.currentTarget,items,result),{class:'primary checkout-action'}));
  } else {
    const reason = shipping ? t('Stripe en mode test reste à connecter.','Stripe test mode is awaiting setup.') :
      t('Les frais et délais de livraison de ce pays restent à configurer.','Shipping prices and times for this country are awaiting setup.');
    content.append(element('p',reason),button(t('Simuler la commande','Simulate order'),()=>{
      result.textContent = t('Simulation terminée. Aucun paiement ni envoi.','Simulation complete. No payment or shipment.');
      result.dataset.tone='success';
    },{class:'primary checkout-action'}));
  }
  content.append(result);
}
async function pay(control,items,result) {
  control.disabled=true;
  result.textContent='';
  try {
    const response = await fetch('/api/checkout',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({country,lines:items,language:config.language})
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    location.assign(data.url);
  } catch (error) {
    result.textContent = error.message;
    result.dataset.tone='error';
    control.disabled=false;
  }
}
function openCheckout(item = null) {
  directOrder = item;
  renderCheckout();
  modal.showModal();
}
get('basket').addEventListener('click',()=>openCheckout());
const productForm = get('product-actions');
if (productForm) productForm.addEventListener('submit',event=>{
  event.preventDefault();
  const {variant,quantity} = Object.fromEntries(new FormData(productForm));
  const item = {id:productForm.dataset.product,variantId:variant,quantity:Number(quantity)};
  if (event.submitter?.value==='buy') {
    openCheckout(item);
  } else if (cart.add(item.id,item.variantId,item.quantity)) {
    get('product-feedback').textContent=t('Ajouté au panier.','Added to your cart.');
    get('product-feedback').dataset.tone='success';
  }
});
if (new URLSearchParams(location.search).get('test')==='retour') {
  const message=element('p',t('Retour de Stripe en mode test. Le statut du paiement se vérifie dans l’administration.','Returned from Stripe test mode. Check payment status in the administration panel.'),{class:'test-return',role:'status'});
  get('main').prepend(message);
}
