const get = id => document.getElementById(id);
const form = get('auth');
const destination = new URLSearchParams(location.search).get('destination');
const adminPath = ['products','settings','profile','printful','orders'].includes(destination) ? '/admin?tab='+destination : '/admin';
get('admin-link').href = adminPath;
let mode = 'login';
let hasOwner = false;

async function request(path, data) {
  const response = await fetch('/api/account/'+path,data === undefined ? undefined : {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Action impossible.');
  return payload;
}
function showPassword(visible) {
  form.elements.password.type = visible ? 'text' : 'password';
  get('show-password').setAttribute('aria-label',visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
  get('show-password').setAttribute('aria-pressed',String(visible));
  get('password-slash').toggleAttribute('hidden',!visible);
}
get('show-password').onclick = ()=>showPassword(form.elements.password.type === 'password');
function selectMode(next) {
  mode = next;
  const register = mode === 'register';
  const label = register ? 'Créer un compte' : 'Se connecter';
  get('form-title').textContent = get('submit').textContent = label;
  get('password-hint').hidden = !register;
  form.elements.password.minLength = register ? 15 : 1;
  form.elements.password.autocomplete = register ? 'new-password' : 'current-password';
  form.elements.password.value = '';
  showPassword(false);
  get('explanation').textContent = register
    ? 'L’adresse du compte propriétaire est reprise automatiquement. Choisis ton mot de passe TSŪ.'
    : 'Utilise l’adresse et le mot de passe de ton compte TSŪ.';
  document.querySelectorAll('[data-mode]').forEach(button=>{
    if (button.dataset.mode === next) button.setAttribute('aria-current','true');
    else button.removeAttribute('aria-current');
  });
}
async function run(button, action) {
  if (button) button.disabled = true;
  get('notice').textContent = '';
  try { await action(); }
  catch (error) { get('notice').textContent = error.message; }
  finally { if (button) button.disabled = false; }
}
async function refresh() {
  const account = await request('state');
  hasOwner = account.hasOwner;
  form.elements.email.value = account.email ?? '';
  get('guest').hidden = Boolean(account.signedIn);
  get('signed-in').hidden = !account.signedIn;
  get('email').textContent = account.email ?? '';
  document.querySelector('[data-mode=register]').hidden = hasOwner;
  if (!account.signedIn) selectMode(hasOwner ? 'login' : 'register');
}
document.querySelectorAll('[data-mode]').forEach(button=>{button.onclick=()=>selectMode(button.dataset.mode);});
form.onsubmit = event=>{
  event.preventDefault();
  return run(event.submitter,async ()=>{
    const values = Object.fromEntries(new FormData(form));
    await request(mode, values);
    location.assign(adminPath);
  });
};
get('logout').onclick = event=>run(event.currentTarget,async ()=>{
  await request('logout',{});
  await refresh();
});
run(null,refresh);
