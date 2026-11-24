// Node 20+. TSU_SITE_ORIGIN is the trusted shop origin, without a path.
// Credentials stay in the scheduler's environment. Redirects are rejected.
const origin = new URL(process.env.TSU_SITE_ORIGIN || '');
if (origin.protocol !== 'https:' || origin.href !== origin.origin+'/' || origin.username || origin.password) {
  throw new Error('TSU_SITE_ORIGIN doit être une origine HTTPS.');
}
const key = process.env.TSU_CATALOG_CRON_SECRET;
if (!key || key.length<32) throw new Error('Configurer le secret dédié au catalogue.');
const headers = {authorization:'Bearer '+key};
if (process.env.TSU_SITES_SERVICE_TOKEN) {
  if (origin.hostname!=='tsu-otaku-shop.sandy-field-0353.chatgpt.site') {
    throw new Error('Ce jeton de service est limité au site TSŪ privé.');
  }
  headers['OAI-Sites-Authorization']='Bearer '+process.env.TSU_SITES_SERVICE_TOKEN;
}
const endpoint = new URL('/api/jobs/printful-catalog',origin);
let added=0;

for (;;) {
  const response = await fetch(endpoint,{method:'POST',headers,redirect:'error',signal:AbortSignal.timeout(60000)});
  if (!response.ok) throw new Error('Synchronisation du catalogue indisponible (HTTP '+response.status+').');
  const page = await response.json();
  if (page.state==='busy') {
    console.log('Une autre synchronisation est en cours.');
    break;
  }
  if (!['ok','partial'].includes(page.state) || typeof page.completed!=='boolean') throw new Error('Réponse de synchronisation invalide.');
  added+=page.added;

  if (page.completed) {
    console.log(added+' nouveaux brouillons durant cette exécution. '+page.cycleFailed+' fiches à revérifier sur ce parcours.');
    if (page.cycleFailed) process.exitCode=1;
    break;
  }
}
