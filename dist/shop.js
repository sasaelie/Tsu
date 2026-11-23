const copy = {
fr:{bar:'Impression à la demande · Belgique et France',tees:'T-shirts',accessories:'Accessoires',cart:'Panier',label:'Le vestiaire otaku',tag:'Pour ceux qui savent.',pitch:'T-shirts et accessoires inspirés du manga et du folklore japonais.',see:'Voir la collection',demo:'Catalogue de démonstration',collection:'La collection',all:'Tout',close:'Fermer',size:'Taille',add:'Ajouter au panier',added:'Ajouté au panier',empty:'Ton panier est vide.',total:'Sous-total',country:'Pays de livraison',be:'Belgique',france:'France',test:'Simuler la commande',success:'Commande simulée. Aucun paiement ni envoi.',pending:'Les paiements Stripe et les commandes Printful seront disponibles après connexion des comptes et configuration des produits.',remove:'Retirer une unité',more:'Ajouter une unité'},
en:{bar:'Print on demand · Belgium and France',tees:'T-shirts',accessories:'Accessories',cart:'Cart',label:'The otaku wardrobe',tag:'For those who know.',pitch:'T-shirts and accessories inspired by manga and Japanese folklore.',see:'Shop the collection',demo:'Demo catalog',collection:'The collection',all:'All',close:'Close',size:'Size',add:'Add to cart',added:'Added to cart',empty:'Your cart is empty.',total:'Subtotal',country:'Shipping country',be:'Belgium',france:'France',test:'Simulate order',success:'Order simulated. No payment or shipment.',pending:'Stripe payments and Printful orders will be available once accounts are connected and products are configured.',remove:'Remove one',more:'Add one'}
};

const catalog = [
  {id:'kitsune',name:'Kitsune',type:'tee',price:2900,bg:'#ff87c9',fill:'#25212b',mark:'狐',kind:['T-shirt classique','Classic T-shirt']},
  {id:'arcade',name:'Arcade',type:'tee',price:3500,bg:'#ffe34e',fill:'#f6f1e4',mark:'✸',kind:['T-shirt oversize','Oversized T-shirt']},
  {id:'yokai',name:'Yōkai Club',type:'acc',price:1900,bg:'#a1caff',fill:'#f7edcf',mark:'怪',kind:['Tote bag','Tote bag']},
  {id:'signal',name:'Signal TSŪ',type:'acc',price:2400,bg:'#ff9d73',fill:'#292333',mark:'TSŪ',kind:['Casquette','Cap']}
];

const silhouettes = {
  tee:'<path d="M57 27 37 34 10 58l20 28 20-13v67h80V73l20 13 20-28-27-24-20-7c-9 19-37 19-46 0Z"/>',
  yokai:'<path d="M63 62V38a27 27 0 0 1 54 0v24" fill="none" stroke-width="9"/><path d="M32 61h116l-9 83H41Z"/>',
  signal:'<path d="M41 92c0-32 21-55 50-55 32 0 53 22 53 57l-58 15Z"/><path d="M42 92c22 5 51 12 81 6 24-5 43-4 46 4 3 11-33 21-57 21-30 0-65-14-70-31Z"/>'
};
const get = id => document.getElementById(id);
const lookup = id => catalog.find(item => item.id === id);
const read = (key,fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
let language = read('tsu-language','fr') === 'en' ? 'en' : 'fr';
let cart = read('tsu-cart',[]);
if (!Array.isArray(cart)) cart = [];
cart = cart.filter(item => item && lookup(item.id) && /^(S|M|L|XL|XXL|)$/.test(item.size) && Number.isSafeInteger(item.quantity) && item.quantity > 0);
let category = 'all';
let country = 'BE';

const tr = key => copy[language][key];
const money = cents => new Intl.NumberFormat(language === 'fr' ? 'fr-BE' : 'en-IE',{style:'currency',currency:'EUR'}).format(cents/100);
const picture = item => {
  const path = silhouettes[item.type === 'tee' ? 'tee' : item.id];
  const ink = item.fill.startsWith('#f') ? '#21182a' : '#ffe440';
  const y = item.id === 'signal' ? 85 : 102;
  return '<div class="picture" style="--bg:'+item.bg+'"><svg viewBox="0 0 180 155" aria-hidden="true"><g fill="'+item.fill+'" stroke="#18131d" stroke-width="3" stroke-linejoin="round">'+path+'</g><text x="90" y="'+y+'" text-anchor="middle" font-size="23" font-weight="900" fill="'+ink+'">'+item.mark+'</text></svg></div>';
};
function render(){
  document.documentElement.lang = language;
  get('language').textContent = language === 'fr' ? 'EN' : 'FR';
  get('language').setAttribute('aria-label',language === 'fr' ? 'English' : 'Français');
  document.querySelectorAll('[data-copy]').forEach(node => { node.textContent = tr(node.dataset.copy); });
  document.querySelectorAll('#filters button').forEach(node => node.setAttribute('aria-pressed',String(node.dataset.filter === category)));
  get('products').innerHTML = catalog.filter(item => category === 'all' || category === item.type)
    .map(item => '<button class="card" data-product="'+item.id+'">'+picture(item)+'<span><strong>'+item.name+'</strong><small>'+item.kind[language === 'fr' ? 0 : 1]+' · '+money(item.price)+'</small></span></button>').join('');
  updateCount();
}
function updateCount(){
  get('count').textContent = cart.reduce((sum,item) => sum + item.quantity,0);
}
function saveCart(){
  localStorage.setItem('tsu-cart',JSON.stringify(cart));
  updateCount();
}
const closeButton = () => '<button class="close" data-close aria-label="'+tr('close')+'">✕</button>';
function openProduct(item){
  const sizes = item.type === 'tee' ? '<label class="row">'+tr('size')+' <select id="size">'+['S','M','L','XL','XXL'].map(size=>'<option>'+size+'</option>').join('')+'</select></label>' : '';
  get('detail').innerHTML = closeButton()+'<h2>'+item.name+'</h2><div class="detail-image">'+picture(item)+'</div><p>'+item.kind[language === 'fr' ? 0 : 1]+' · '+money(item.price)+'</p>'+sizes+'<button class="primary" data-add="'+item.id+'">'+tr('add')+'</button>';
  get('product').showModal();
}
function renderCart(){
  const subtotal = cart.reduce((sum,item) => sum + lookup(item.id).price * item.quantity,0);
  const lines = cart.map((item,index) => '<div class="item"><span>'+lookup(item.id).name+(item.size ? ' · '+item.size : '')+'<br>'+money(lookup(item.id).price * item.quantity)+'</span><div><button data-index="'+index+'" data-change="-1" aria-label="'+tr('remove')+'">−</button> '+item.quantity+' <button data-index="'+index+'" data-change="1" aria-label="'+tr('more')+'">+</button></div></div>').join('');
  get('cartContent').innerHTML = closeButton()+'<h2>'+tr('cart')+'</h2>'+(
    cart.length ? lines+'<p><strong>'+tr('total')+' · '+money(subtotal)+'</strong></p><label class="row">'+tr('country')+' <select id="country"><option value="BE">'+tr('be')+'</option><option value="FR">'+tr('france')+'</option></select></label><p>'+tr('pending')+'</p><button class="primary" id="simulate">'+tr('test')+'</button><p id="result" class="message" role="status" hidden></p>' :
    '<p>'+tr('empty')+'</p>');
  if (get('country')) get('country').value = country;
}
document.addEventListener('click',event=>{
  const button = event.target.closest('button, a');
  if (!button) return;
  if (button.dataset.filter) {
    category = button.dataset.filter;
    render();
    if(button.tagName === 'BUTTON') document.querySelector('#filters [aria-pressed=true]').focus();
  }
  if (button.id === 'language') {
    language = language === 'fr' ? 'en' : 'fr';
    localStorage.setItem('tsu-language',JSON.stringify(language));
    render();
  }
  if (button.dataset.product) openProduct(lookup(button.dataset.product));
  if ('close' in button.dataset) button.closest('dialog').close();
  if (button.dataset.add) {
    const size = get('size')?.value ?? '';
    const existing = cart.find(item => item.id === button.dataset.add && item.size === size);
    if (existing) existing.quantity++;
    else cart.push({id:button.dataset.add,size,quantity:1});
    saveCart();
    get('product').close();
    get('announcement').textContent = tr('added')+' · '+get('count').textContent;
  }
  if (button.id === 'basket') {
    renderCart();
    get('checkout').showModal();
  }
  if (button.dataset.change) {
    const index = Number(button.dataset.index);
    cart[index].quantity += Number(button.dataset.change);
    if (!cart[index].quantity) cart.splice(index,1);
    saveCart();
    renderCart();
    const next = [...get('cartContent').querySelectorAll('[data-change]')].find(node=>node.dataset.index === button.dataset.index && node.dataset.change === button.dataset.change);
    (next ?? get('cartContent').querySelector('.close')).focus();
  }
  if (button.id === 'simulate') {
    get('result').hidden = false;
    get('result').textContent = tr('success');
  }
});
document.addEventListener('change',event=>{ if(event.target.id === 'country') country = event.target.value; });
render();
