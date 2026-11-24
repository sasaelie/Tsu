const consentKey='tsu-statistics-consent';

export function setupAnalytics(settings) {
  if (!settings) return {track(){},purchase(){},onStart(){}};

  const {id,mode,path}=settings;
  const panel=document.getElementById('analytics-consent');
  let choice=null;
  try { choice=localStorage.getItem(consentKey); } catch {}
  let started=false;
  const listeners=[];
  const pageLocation=location.origin+path;
  let pageReferrer='';
  try {
    const referrer=new URL(document.referrer);
    if (referrer.protocol==='https:' && referrer.hostname!=='checkout.stripe.com') pageReferrer=referrer.origin;
  } catch {}
  function send() { window.dataLayer.push(arguments); }
  function track(event,details={}) {
    if (choice!=='yes' || !started) return;
    send('event',event,{...details,page_location:pageLocation});
  }
  function start() {
    if (started) return;
    started=true;
    window.dataLayer=window.dataLayer??[];
    send('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
    send('consent','update',{analytics_storage:'granted'});
    send('js',new Date());
    send('config',id,{send_page_view:false,page_location:pageLocation,page_referrer:pageReferrer,
      allow_google_signals:false,allow_ad_personalization_signals:false,cookie_domain:location.hostname,...(mode==='test'?{debug_mode:true}:{})});
    const tag=document.createElement('script');
    tag.async=true;
    tag.referrerPolicy='no-referrer';
    tag.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(id);
    document.head.append(tag);
    track('page_view');
    for (const listener of listeners.splice(0)) listener();
  }
  function decide(value) {
    choice=value;
    try { localStorage.setItem(consentKey,value); } catch {}
    panel.hidden=true;
    if (value==='yes') {
      window['ga-disable-'+id]=false;
      if (started) send('consent','update',{analytics_storage:'granted'});
      else start();
    } else if (started) {
      window['ga-disable-'+id]=true;
      send('consent','update',{analytics_storage:'denied'});
      for (const name of document.cookie.split(';').map(cookie=>cookie.split('=')[0].trim()).filter(name=>/^_ga(?:_[A-Z0-9]+)?$/.test(name))) {
        document.cookie=name+'=; Max-Age=0; Path=/; Secure';
        document.cookie=name+'=; Max-Age=0; Path=/; Secure; Domain='+location.hostname;
      }
    }
  }
  document.getElementById('analytics-accept').onclick=()=>decide('yes');
  document.getElementById('analytics-reject').onclick=()=>decide('no');
  document.getElementById('analytics-settings').onclick=()=>{
    panel.hidden=!panel.hidden;
    if (!panel.hidden) document.getElementById('analytics-reject').focus();
  };
  panel.hidden=choice==='yes' || choice==='no';
  if (choice==='yes') start();

  const testButton=document.getElementById('analytics-test-send');
  if (testButton && mode==='test') testButton.onclick=()=>{
    const status=document.getElementById('analytics-test-status');
    if (choice!=='yes' || !started) {
      panel.hidden=false;
      document.getElementById('analytics-accept').focus();
      status.textContent=document.documentElement.lang==='en'?'Accept statistics, then send the signal.':'Accepte les statistiques, puis envoie le signal.';
      return;
    }
    track('tsu_test_signal',{debug_mode:true});
    status.textContent=document.documentElement.lang==='en'?'Signal requested. Check DebugView.':'Signal demandé. Vérifie dans DebugView.';
  };

  return {
    track,
    onStart(listener) { if (started) listener(); else listeners.push(listener); },
    purchase(order) {
      if (choice!=='yes' || order.mode!==mode || order.payment!=='paid' || !order.analytics?.items?.length) return;
      const {items,shipping}=order.analytics;
      const seenKey='tsu-ga-order-'+id+'-'+order.reference;
      try { if (sessionStorage.getItem(seenKey)) return; } catch {}
      track('purchase',{transaction_id:order.reference,currency:'EUR',shipping,items,
        value:items.reduce((sum,item)=>sum+Math.round(item.price*100)*item.quantity,0)/100});
      try { sessionStorage.setItem(seenKey,'1'); } catch {}
    }
  };
}
