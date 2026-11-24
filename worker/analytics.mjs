const gaMeasurementPattern=/^G-[A-Z0-9]{6,20}$/;
const googleVerificationPattern=/^[a-zA-Z0-9_-]{10,180}$/;

async function analyticsSettings(env) {
  const row=await env.DB.prepare('SELECT data FROM analytics_settings WHERE id=1').first();
  return row ? JSON.parse(row.data) : {productionId:'',testId:'',searchConsole:''};
}
async function saveAnalyticsSettings(env,input) {
  const productionId=text(input.productionId,40).toUpperCase();
  const testId=text(input.testId,40).toUpperCase();
  const searchConsole=text(input.searchConsole,220);
  if ([productionId,testId].some(id=>id && !gaMeasurementPattern.test(id))) fail('Saisis un ID de mesure GA4 au format G-…');
  if (productionId && productionId===testId) fail('Utilise deux ID distincts pour séparer les tests des ventes réelles.');
  if (searchConsole && !googleVerificationPattern.test(searchConsole)) fail('Colle uniquement la valeur de content de la balise google-site-verification.');
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
