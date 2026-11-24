const get = id => document.getElementById(id);
const form = get('auth');
const en = new URLSearchParams(location.search).get('lang')==='en';
const t = (fr,english)=>en?english:fr;
let recovery = new URLSearchParams(location.hash.slice(1)).get('recovery');
if (recovery) history.replaceState(null,'',location.pathname+location.search);
if(en){
  document.documentElement.lang='en';
  document.querySelector('h1').textContent=document.title='TSŪ administrator sign-in';
  document.querySelector('header span').textContent='Store';
  document.querySelector('[data-mode=login]').textContent='Sign in';
  document.querySelector('[data-mode=register]').textContent='Create an account';
  document.querySelector('#signed-in h2').textContent='Owner account';
  const labels={loading:'Checking your owner account…','email-label':'Email address','password-hint':'Choose a unique password of at least 15 characters.','forgot-password':'Forgot password?','admin-link':'Open administration',logout:'Sign out'};
  for(const [id,label] of Object.entries(labels)) get(id).textContent=label;
}
const destination = new URLSearchParams(location.search).get('destination');
const adminPath = ['products','settings','profile','printful','orders','customers','journal'].includes(destination) ? '/admin?tab='+destination : '/admin';
get('admin-link').href = adminPath;
let mode = 'login';
let hasOwner = false;

async function request(path, data) {
  const response = await fetch('/api/account/'+path,data === undefined ? undefined : {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)
  });
  let payload;
  try { payload = await response.json(); }
  catch { throw new Error('Ouvre TSŪ dans ton navigateur et connecte-toi au compte ChatGPT propriétaire.'); }
  if (!response.ok) throw new Error(payload.error || 'Action impossible.');
  return payload;
}
function showPassword(visible) {
  form.elements.password.type = visible ? 'text' : 'password';
  get('show-password').setAttribute('aria-label',visible ? t('Masquer le mot de passe','Hide password') : t('Afficher le mot de passe','Show password'));
  get('show-password').setAttribute('aria-pressed',String(visible));
  get('password-slash').toggleAttribute('hidden',!visible);
}
get('show-password').onclick = ()=>showPassword(form.elements.password.type === 'password');
function selectMode(next) {
  mode = next;
  const register = mode === 'register';
  const resetting=mode==='reset-password';
  const asking=mode==='reset-request';
  const label = asking?t('Recevoir le lien de récupération','Send recovery link'):resetting?t('Enregistrer mon nouveau mot de passe','Save new password'):register?t('Créer un compte','Create an account'):t('Se connecter','Sign in');
  get('form-title').textContent = get('submit').textContent = label;
  get('forgot-password').hidden = !hasOwner || mode!=='login';
  get('password-hint').hidden = !(register||resetting);
  get('password-field').hidden = form.elements.password.disabled = asking;
  get('password-label').textContent=resetting?t('Nouveau mot de passe TSŪ','New TSŪ password'):t('Mot de passe administrateur TSŪ','TSŪ administrator password');
  form.elements.password.minLength = register||resetting ? 15 : 1;
  form.elements.password.autocomplete = register||resetting ? 'new-password' : 'current-password';
  form.elements.password.value = '';
  showPassword(false);
  get('explanation').textContent=asking?t('Le lien sera envoyé à l’adresse du propriétaire affichée ci-dessous.','The link will be emailed to the owner address shown below.'):resetting?t('Choisis un nouveau mot de passe. Les sessions d’administration ouvertes seront fermées.','Choose a new password. Existing administrator sessions will be closed.'):register?t('L’adresse du compte propriétaire est reprise automatiquement. Choisis ton mot de passe TSŪ.','Choose your TSŪ password for the owner email shown below.'):t('Utilise le mot de passe que tu as choisi pour l’administration de la boutique.','Enter the password you chose for the store administration.');
  document.querySelectorAll('[data-mode]').forEach(button=>{
    if (button.dataset.mode === next) button.setAttribute('aria-current','true');
    else button.removeAttribute('aria-current');
  });
}
async function run(button, action, status = get('notice')) {
  if (button) button.disabled = true;
  status.textContent = '';
  try { await action(); }
  catch (error) { status.textContent = error.message; status.dataset.tone='error'; }
  finally { if (button) button.disabled = false; }
}
async function refresh() {
  const account = await request('state');
  hasOwner = account.hasOwner;
  form.elements.email.value = account.email ?? '';
  get('guest').hidden = Boolean(account.signedIn && !recovery);
  get('signed-in').hidden = !account.signedIn || Boolean(recovery);
  get('email').textContent = account.email ?? '';
  document.querySelector('[data-mode=register]').hidden = hasOwner;
  if (!account.signedIn || recovery) selectMode(recovery&&hasOwner?'reset-password':hasOwner?'login':'register');
}
document.querySelectorAll('[data-mode]').forEach(button=>{button.onclick=()=>selectMode(button.dataset.mode);});
get('forgot-password').onclick=()=>{get('login-result').textContent='';selectMode('reset-request');};
form.onsubmit = event=>{
  event.preventDefault();
  const status=get('login-result');
  return run(event.submitter,async ()=>{
    status.dataset.tone='pending';
    status.textContent=t('Traitement en cours…','Processing…');
    const values = Object.fromEntries(new FormData(form));
    if (mode==='reset-request' || mode==='reset-password') {
      const resetting=mode==='reset-password';
      await request(mode,resetting?{token:recovery,password:values.password,language:en?'en':'fr'}:{language:en?'en':'fr'});
      if (resetting) recovery=null;
      selectMode('login');
      status.dataset.tone='success';
      status.textContent=resetting?t('Mot de passe enregistré. Connecte-toi à nouveau.','Password saved. Sign in again.'):t('Lien envoyé à ton adresse propriétaire. Il est valable 30 minutes.','Recovery link sent to your owner email. It is valid for 30 minutes.');
      return;
    }
    await request(mode, values);
    const account=await request('state');
    if (!account.signedIn) throw new Error('Le mot de passe est accepté, mais ta session ne reste pas ouverte. Ouvre TSŪ directement dans Chrome, puis reconnecte-toi ici.');
    location.assign(adminPath);
  },status);
};
get('logout').onclick = event=>run(event.currentTarget,async ()=>{
  await request('logout',{});
  await refresh();
});
run(null,refresh).finally(()=>{get('loading').hidden=true;});
