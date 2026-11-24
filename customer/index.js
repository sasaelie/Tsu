const get = id=>document.getElementById(id);
const en = location.pathname.startsWith('/en/');
const t = (fr,english)=>en?english:fr;
const auth = get('auth');
const ticketForm = get('ticket-form');
const formatAmount = cents=>new Intl.NumberFormat(en?'en-IE':'fr-BE',{style:'currency',currency:'EUR'}).format(cents/100);
const date = value=>new Intl.DateTimeFormat(en?'en-IE':'fr-BE',{dateStyle:'medium',timeZone:'Europe/Brussels'})
  .format(new Date(value.replace(' ','T')+'Z'));
let account;
let mode = 'login';
let recovery = new URLSearchParams(location.hash.slice(1)).get('recovery');
if (recovery) history.replaceState(null,'',location.pathname+location.search);
let verification = new URLSearchParams(location.hash.slice(1)).get('verification');
if (verification) history.replaceState(null,'','#newsletter');
if (en) {
  document.documentElement.lang='en';
  document.title='My account | TSŪ';
  const labels = {
    title:'My account','forgot-password':'Forgot password?', 'open-login':'Sign in', 'open-register':'Create an account','email-label':'Email address',
    'password-label':'Password','password-hint':'At least 15 characters.','guest-news':'Create an account to join the newsletter and browse subscriber-only designs.',
    signout:'Sign out','orders-title':'My orders','tickets-title':'My support tickets','ticket-order-label':'Related order (optional)',
    'ticket-subject-label':'Subject','ticket-message-label':'Message','ticket-submit':'Open a ticket',
    'newsletter-detail':'Get early previews of new designs and browse subscriber-only pieces.',
    privacy:'Privacy policy','request-verification':'Send a verification link','confirm-verification':'Verify my email','member-designs':'Browse subscriber designs'
  };
  for (const [id,label] of Object.entries(labels)) get(id).textContent=label;
  ['Orders','Support','Newsletter'].forEach((label,index)=>{get('client-navigation').children[index].textContent=label;});
  const language=get('language'); language.href='/espace-client'; language.hreflang='fr'; language.textContent='FR';
  get('privacy').href='/en/privacy';
  get('shop-link').href='/en';
  get('member-designs').href='/en#member-designs';
}

async function api(route,data) {
  const response=await fetch('/api/customer/'+route,data===undefined?undefined:{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)
  });
  const payload=await response.json();
  if (!response.ok) throw new Error(payload.error ?? t('Requête impossible.','Request failed.'));
  return payload;
}
function element(tag,value,className) {
  const el=document.createElement(tag);
  if (value!=null) el.textContent=value;
  if (className) el.className=className;
  return el;
}
function control(label,callback) {
  const el=element('button',label); el.type='button'; el.onclick=()=>run(el,callback); return el;
}
function notice(message,tone='neutral') {
  const el=get('notice'); el.textContent=message; el.dataset.tone=tone;
}
async function run(button,action) {
  if (button) button.disabled=true;
  notice('');
  try { await action(); }
  catch(error) { notice(error.message,'error'); }
  finally { if (button) button.disabled=false; }
}
function togglePassword(visible) {
  auth.elements.password.type=visible?'text':'password';
  const button=get('password-toggle');
  button.textContent=visible?t('Masquer le mot de passe','Hide password'):t('Afficher le mot de passe','Show password');
  button.setAttribute('aria-pressed',String(visible));
}
function showMode(next) {
  mode=next;
  const register=mode==='register';
  const asking=mode==='reset-request';
  const resetting=mode==='reset-password';
  const title=asking?t('Recevoir le lien de récupération','Send recovery link'):resetting?t('Enregistrer mon nouveau mot de passe','Save new password'):register?t('Créer un compte','Create an account'):t('Se connecter','Sign in');
  get('auth-title').textContent=get('auth-submit').textContent=title;
  get('password-label').textContent=resetting?t('Nouveau mot de passe','New password'):t('Mot de passe','Password');
  get('auth-email-field').hidden=resetting;
  auth.elements.email.disabled=resetting;
  auth.elements.password.disabled=asking;
  get('auth-password-field').hidden=get('password-toggle').hidden=asking;
  get('forgot-password').hidden=mode!=='login';
  get('password-hint').hidden=!(register||resetting);
  auth.elements.password.value='';
  auth.elements.password.minLength=register||resetting?15:1;
  auth.elements.password.autocomplete=register||resetting?'new-password':'current-password';
  togglePassword(false);
}
function orderStatus(order) {
  if (order.payment==='expired') return t('Session expirée','Checkout expired');
  if (order.payment==='failed') return t('Paiement échoué','Payment failed');
  if (order.payment!=='paid') return t('Paiement en attente','Payment pending');
  if (order.mode==='test') return t('Payée en test','Paid in test mode');
  return ({
    draft:t('Commande reçue','Order received'), pending:t('En préparation','Preparing'),
    inprocess:t('En fabrication','In production'), fulfilled:t('Expédiée','Shipped'),
    partial:t('Partiellement expédiée','Partially shipped'), canceled:t('Annulée','Cancelled'),
    failed:t('Commande à vérifier','Order being reviewed'), onhold:t('En attente','On hold')
  })[order.status] ?? t('Paiement confirmé','Payment confirmed');
}
function orderEntry(order) {
  const item=element('article',null,'client-entry');
  item.append(element('strong',orderStatus(order)),element('p',date(order.createdAt)+' · '+formatAmount(order.total)),element('p',order.id));
  const list=element('ul');
  for(const product of order.items) list.append(element('li',product.quantity+' × '+product.name));
  item.append(list);
  if (order.payment==='paid') {
    const withdrawal=element('a',t('Se rétracter ici','Withdraw from your contract here'));
    withdrawal.href=t('/retractation','/en/withdraw')+'?commande='+encodeURIComponent(order.id);
    item.append(withdrawal);
  }
  for (const shipment of order.shipments) {
    if (!shipment.number) continue;
    const label=t('Suivre le colis','Track parcel')+' '+shipment.number;
    const link=element(shipment.url?'a':'p',label);
    if(shipment.url){link.href=shipment.url; link.rel='noopener noreferrer';}
    item.append(link);
  }
  item.append(control(t('Actualiser le suivi','Refresh tracking'),async()=>{
    const updated=await api('tracking',{id:order.id});
    item.replaceWith(orderEntry(updated));
    notice(t('Suivi mis à jour.','Tracking updated.'),'success');
  }));
  return item;
}
function ticketEntry(ticket) {
  const details=element('details',null,'client-entry');
  details.append(element('summary',ticket.subject+' · '+(ticket.status==='open'?t('Ouvert','Open'):t('Fermé','Closed'))));
  if (ticket.order_id) details.append(element('p',t('Commande','Order')+' '+ticket.order_id));
  for (const row of ticket.messages) {
    details.append(element('strong',row.sender==='shop'?'TSŪ':t('Toi','You')),
      element('p',row.message,'ticket-message'));
  }
  if (ticket.status==='open') {
    const form=element('form',null,'client-form');
    const label=element('label',t('Répondre','Reply'));
    const message=element('textarea'); message.rows=3; message.maxLength=4000; message.required=true;
    const submit=element('button',t('Envoyer la réponse','Send reply'));
    label.append(message);
    form.append(label,submit);
    form.onsubmit=event=>{
      event.preventDefault();
      run(submit,async()=>{await api('tickets/reply',{id:ticket.id,message:message.value}); await refresh(ticket.id); notice(t('Réponse envoyée.','Reply sent.'),'success');});
    };
    details.append(form);
  }
  return details;
}
async function refresh(openTicket) {
  account=await api('state');
  if (recovery && mode==='reset-password') { get('guest').hidden=false; get('client-panel').hidden=true; return; }
  get('guest').hidden=account.signedIn;
  get('client-panel').hidden=!account.signedIn;
  if (!account.signedIn) {
    get('guest-news').hidden=location.hash!=='#newsletter';
    return;
  }
  get('client-email').textContent=account.email;
  const orders=get('order-list');
  orders.replaceChildren(...account.orders.map(orderEntry));
  if (!account.orders.length) orders.append(element('p',t('Tes commandes passées avec ce compte apparaîtront ici.','Orders placed while signed in will appear here.')));
  const select=ticketForm.elements.orderId;
  const previous=select.value;
  select.replaceChildren(new Option(t('Aucune','None'),''),...account.orders.map(order=>new Option(order.id,order.id)));
  if (account.orders.some(order=>order.id===previous)) select.value=previous;
  get('ticket-list').replaceChildren(...account.tickets.map(ticket=>{
    const entry=ticketEntry(ticket); entry.open=ticket.id===openTicket; return entry;
  }));
  get('newsletter-state').textContent=account.newsletter
    ? (account.verified?t('Inscription confirmée.','Subscription confirmed.'):account.emailReady
      ? t('Confirme ton adresse pour recevoir les e-mails.','Verify your address to receive emails.')
      : t('Inscription enregistrée. L’envoi d’e-mails sera disponible après configuration.','Subscription recorded. Email delivery is awaiting setup.'))
    : t('Tu peux te désinscrire ici à tout moment.','You can unsubscribe here at any time.');
  get('newsletter-choice').textContent=account.newsletter?t('Me désinscrire','Unsubscribe'):t('M’inscrire à la newsletter','Join the newsletter');
  get('request-verification').hidden=account.verified || !account.emailReady || !account.newsletter || Boolean(verification);
  get('confirm-verification').hidden=!verification;
  get('member-designs').hidden=!account.member;
}
get('forgot-password').onclick=()=>{notice('');showMode('reset-request');auth.elements.email.focus();};
get('open-login').onclick=()=>showMode('login');
get('open-register').onclick=()=>showMode('register');
get('password-toggle').onclick=()=>togglePassword(auth.elements.password.type==='password');
auth.onsubmit=event=>{
  event.preventDefault();
  run(event.submitter,async()=>{
    const input=Object.fromEntries(new FormData(auth));
    if (mode==='reset-request') {
      await api(mode,{email:input.email,language:en?'en':'fr'});
      showMode('login');
      notice(t('Si un compte correspond à cette adresse, tu recevras un lien valable 30 minutes.','If this address matches an account, you will receive a link valid for 30 minutes.'),'success');
      return;
    }
    if (mode==='reset-password') {
      await api(mode,{password:input.password,token:recovery,language:en?'en':'fr'});
      recovery=null;
      auth.reset();
      showMode('login');
      await refresh();
      notice(t('Mot de passe enregistré. Connecte-toi avec ton nouveau mot de passe.','Your new password is saved. Sign in with it now.'),'success');
      return;
    }
    await api(mode,input);
    auth.reset();
    await refresh();
    if(location.hash==='#newsletter')get('newsletter').scrollIntoView();
  });
};
get('signout').onclick=event=>run(event.currentTarget,async()=>{await api('logout',{}); await refresh(); showMode('login');});
ticketForm.onsubmit=event=>{
  event.preventDefault();
  run(event.submitter,async()=>{const {id}=await api('tickets/new',Object.fromEntries(new FormData(ticketForm))); ticketForm.reset(); await refresh(id); notice(t('Ticket ouvert.','Ticket opened.'),'success');});
};
get('newsletter-choice').onclick=event=>run(event.currentTarget,async()=>{await api('newsletter',{enabled:!account.newsletter}); await refresh(); notice(get('newsletter-state').textContent,'success');});
get('request-verification').onclick=event=>run(event.currentTarget,async()=>{await api('send-verification',{}); notice(t('Lien de confirmation envoyé.','Verification link sent.'),'success');});
get('confirm-verification').onclick=event=>run(event.currentTarget,async()=>{await api('verify',{token:verification}); verification=null; await refresh(); notice(t('Adresse confirmée.','Email verified.'),'success');});
showMode(recovery?'reset-password':location.hash==='#newsletter'?'register':'login');
run(null,refresh);
