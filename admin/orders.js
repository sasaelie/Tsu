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
    '.';
  get('auto-fulfillment').checked = state.automaticFulfillment === true;
  const list = get('order-list');
  list.replaceChildren();
  if (!state.orders.length) list.append(element('p','Aucune commande pour le moment.'));
  for (const order of state.orders) {
    const row = element('div',null,'record');
    const details = element('div');
    const payments = { paid:'Payée', unpaid:'En attente de paiement', expired:'Session expirée', failed:'Paiement échoué' };
    const total = order.items.reduce((sum,item)=>sum+item.price*item.quantity,0) + (order.shippingFee ?? 0);
    const printfulStatus = {
      none:order.payment==='paid'?'à envoyer':'en attente du paiement', draft:order.mode==='test'?'brouillon de test':'en attente de fabrication',
      pending:'envoyée pour fabrication',inprocess:'en production',partial:'partiellement expédiée',fulfilled:'expédiée',
      onhold:'suspendue, vérifier dans Printful',failed:'échec, vérifier dans Printful',canceled:'annulée'
    };
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

function saveFulfillmentChoice(event) {
  event.preventDefault();
  const control=event.submitter;
  const input=get('auto-fulfillment');
  const status=get('fulfillment-status');
  const enabled=input.checked;
  input.disabled=true;
  run(control,async()=>{
    try {
      const saved=await api('fulfillment',{enabled});
      state.automaticFulfillment=saved.enabled;
      feedback(status,saved.enabled?'Envoi automatique activé pour les nouveaux achats réels.':'Envoi automatique désactivé.','success');
    } finally {
      input.checked=state.automaticFulfillment===true;
      input.disabled=false;
    }
  },(message,tone)=>feedback(status,message,tone));
}
