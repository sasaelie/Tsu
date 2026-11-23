const get = id => document.getElementById(id);
const form = get('auth');
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
function selectMode(next) {
  mode = next;
  const register = mode === 'register';
  const label = register ? 'Créer un compte' : 'Se connecter';
  get('form-title').textContent = get('submit').textContent = label;
  get('password-hint').hidden = !register;
  form.elements.password.minLength = register ? 15 : 1;
  form.elements.password.autocomplete = register ? 'new-password' : 'current-password';
  form.elements.password.value = '';
  get('explanation').textContent = register
    ? 'Pour créer le compte propriétaire en préproduction, utilise l’adresse e-mail de ton compte ChatGPT actuellement connecté.'
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
    form.reset();
    await refresh();
  });
};
get('logout').onclick = event=>run(event.currentTarget,async ()=>{
  await request('logout',{});
  await refresh();
});
run(null,refresh);
