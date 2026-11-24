async function limitedBody(request, maxBytes) {
  const tooLarge = () => fail('Données trop volumineuses.',413);
  if (Number(request.headers.get('Content-Length')) > maxBytes) tooLarge();
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const {done,value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        void reader.cancel().catch(()=>{});
        tooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk,offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function protectResponse(response) {
  if (!response.headers.get('Content-Type')?.includes('text/html')) return response;
  response.headers.set('Content-Security-Policy',[
    "base-uri 'none'", "object-src 'none'", "form-action 'self'",
    "script-src 'self' https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline'", "img-src 'self' data: https:",
    "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
    "font-src 'self'", "frame-src 'none'"
  ].join('; '));
  response.headers.set('X-Content-Type-Options','nosniff');
  if (!response.headers.has('Referrer-Policy')) response.headers.set('Referrer-Policy','strict-origin-when-cross-origin');
  return response;
}
