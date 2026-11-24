const gaMeasurementPattern=/^G-[A-Z0-9]{6,20}$/;
const googleVerificationPattern=/^[a-zA-Z0-9_-]{10,180}$/;

async function analyticsSettings(env) {
  const row=await env.DB.prepare('SELECT data FROM analytics_settings WHERE id=1').first();
  return row ? JSON.parse(row.data) : {productionId:'',testId:'',searchConsole:''};
}
function measurementIdFrom(value) {
  const raw=text(value,3501).toUpperCase();
  if (!raw || gaMeasurementPattern.test(raw)) return raw;
  if (raw.length>3500 || !raw.includes('GTAG') || !raw.includes('<SCRIPT')) fail('Colle l’ID G-… ou le code Google Analytics complet.');
  const ids=[...new Set(raw.match(/\bG-[A-Z0-9]{6,20}\b/g)??[])];
  if (ids.length!==1) fail('Le code doit contenir un seul identifiant de mesure G-…');
  return ids[0];
}

function searchConsoleFrom(value) {
  const raw=text(value,500);
  if (!raw || googleVerificationPattern.test(raw)) return raw;
  const tag=raw.match(/<meta\s[^<>]*>/gi);
  if (tag?.length===1 && /\bname\s*=\s*(['"])google-site-verification\1/i.test(tag[0])) {
    const token=tag[0].match(/\bcontent\s*=\s*(['"])([a-zA-Z0-9_-]{10,180})\1/i)?.[2];
    if (token) return token;
  }
  fail('Colle la balise de vérification HTML de Search Console ou son jeton.');
}

async function saveAnalyticsSettings(env,input) {
  const productionId=measurementIdFrom(input.productionId);
  const testId=measurementIdFrom(input.testId);
  const searchConsole=searchConsoleFrom(input.searchConsole);
  if (productionId && productionId===testId) fail('Utilise deux ID distincts pour séparer les tests des ventes réelles.');
  const settings={productionId,testId,searchConsole};
  await env.DB.prepare('INSERT INTO analytics_settings (id,data) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data')
    .bind(JSON.stringify(settings)).run();
  return settings;
}

function analyticsControls(en) {
  return '<aside id="analytics-consent" class="analytics-consent" hidden aria-labelledby="analytics-consent-title">'+
    '<h2 id="analytics-consent-title">'+local(en,'Statistiques de visite','Visit statistics')+'</h2>'+
    '<p>'+local(en,'Avec ton accord, Google Analytics mesure les visites et les étapes d’achat. Tu peux modifier ton choix à tout moment.',
      'With your permission, Google Analytics measures visits and shopping activity. You can change your choice at any time.')+'</p>'+
    '<div><button type="button" id="analytics-accept">'+local(en,'Accepter','Accept')+'</button>'+
    '<button type="button" id="analytics-reject">'+local(en,'Refuser','Decline')+'</button></div></aside>';
}

function analyticsTestControls(en) {
  return '<section id="analytics-test" class="shop-section info-page" aria-labelledby="analytics-test-title"><h2 id="analytics-test-title">'+
    local(en,'Tester la réception dans GA4','Test delivery to GA4')+'</h2><p>'+
    local(en,'Ouvre DebugView dans ta propriété de test, puis envoie le signal. Il apparaît sous le nom « tsu_test_signal ».',
      'Open DebugView in your test property, then send the signal. It appears as “tsu_test_signal”.')+'</p>'+
    '<button type="button" id="analytics-test-send">'+local(en,'Envoyer le signal de test','Send test signal')+'</button>'+
    '<p id="analytics-test-status" class="action-feedback" role="status" aria-live="polite"></p></section>';
}
