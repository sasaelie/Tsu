async function credentialKey(secret, name) {
  if (!/^[a-f0-9]{64}$/.test(secret ?? '')) fail('Configuration '+name+' indisponible.',503);
  const bytes = Uint8Array.from(secret.match(/../g),byte=>parseInt(byte,16));
  return crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt']);
}

function binaryBase64(value) {
  return btoa(String.fromCharCode(...new Uint8Array(value)));
}

function base64Binary(value) {
  return Uint8Array.from(atob(value),char=>char.charCodeAt(0));
}
