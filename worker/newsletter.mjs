async function newsletterSignature(env,id) {
  const key = await crypto.subtle.importKey('raw',encoder.encode(env.TSU_AUTH_PEPPER),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(await crypto.subtle.sign('HMAC',key,encoder.encode('newsletter-unsubscribe:'+id)));
}

async function unsubscribeNewsletter(request,env) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const token = url.searchParams.get('token');
  if (!env.TSU_AUTH_PEPPER || !idPattern.test(id ?? '') || !/^[a-f0-9]{64}$/.test(token ?? '') ||
      !equalHash(token,await newsletterSignature(env,id))) fail('Lien de désinscription invalide.',400);
  if (request.method==='GET') return new Response(
    '<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex"><title>Newsletter TSŪ</title><link rel="stylesheet" href="/style.css"><main class="shop-section info-page"><h1>Newsletter TSŪ</h1><form method="post"><button class="primary">Me désinscrire / Unsubscribe</button></form></main></html>',
    {headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}}
  );
  if (request.method!=='POST') fail('Méthode refusée.',405);
  await env.DB.prepare('UPDATE customers SET newsletter_at=NULL WHERE id=?').bind(id).run();
  if (request.headers.get('origin')===url.origin) return new Response(
    '<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Newsletter TSŪ</title><link rel="stylesheet" href="/style.css"><main class="shop-section info-page"><h1>Tu es désinscrit · You have unsubscribed</h1><a href="/">TSŪ</a></main></html>',
    {headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}}
  );
  return json({ok:true});
}

async function sendDesignAnnouncement(request,env) {
  if (!customerEmailReady(env) || !env.TSU_AUTH_PEPPER) fail('Configure d’abord l’expéditeur e-mail.',503);
  const {productId} = await body(request,1024);
  const product = (await products(env)).find(item=>item.id===productId && item.published && ['newsletter','early'].includes(item.audience));
  if (!product) fail('Choisis un design publié pour les abonnés.',404);
  const now = epoch();
  const origin = new URL(request.url).origin;
  const {results} = await env.DB.prepare(`SELECT c.id,c.email,d.created_at FROM customers c
    LEFT JOIN newsletter_deliveries d ON d.product_id=? AND d.customer_id=c.id
    WHERE c.verified_at IS NOT NULL AND c.newsletter_at IS NOT NULL AND d.sent_at IS NULL
    AND (d.created_at IS NULL OR d.created_at>?)
    ORDER BY c.id LIMIT 5`).bind(product.id,now-23*3600).all();
  let sent=0;
  let failed=0;
  // Each person receives a separate message and keeps the same send key on retry.
  for (const contact of results) {
    await env.DB.prepare('INSERT INTO newsletter_deliveries VALUES (?,?,?,NULL) ON CONFLICT DO NOTHING').bind(product.id,contact.id,now).run();
    const current = await env.DB.prepare(`SELECT c.email,d.sent_at FROM customers c JOIN newsletter_deliveries d ON d.customer_id=c.id
      WHERE c.id=? AND d.product_id=? AND c.verified_at IS NOT NULL AND c.newsletter_at IS NOT NULL`).bind(contact.id,product.id).first();
    if (!current || current.sent_at) continue;
    const unsubscribe = origin+'/newsletter/desinscription?id='+contact.id+'&token='+await newsletterSignature(env,contact.id);
    const link = origin+productPath(product);
    try {
      await provider('https://api.resend.com/emails',{
        method:'POST',redirect:'manual',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json',
          'Idempotency-Key':'tsu-design-'+product.id+'-'+contact.id},
        body:JSON.stringify({from:env.TSU_EMAIL_FROM,to:[current.email],subject:'Nouveau design TSŪ : '+product.name,
          text:product.name+' est disponible pour les abonnés TSŪ.\n\n'+link+'\n\nSe désinscrire / Unsubscribe : '+unsubscribe,
          headers:{'List-Unsubscribe':'<'+unsubscribe+'>','List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}})
      },'Le service e-mail');
      await env.DB.prepare('UPDATE newsletter_deliveries SET sent_at=? WHERE product_id=? AND customer_id=?').bind(epoch(),product.id,contact.id).run();
      sent++;
    } catch { failed++; }
  }
  const {remaining,review} = await env.DB.prepare(`SELECT
    COUNT(CASE WHEN d.created_at IS NULL OR d.created_at>? THEN 1 END) AS remaining,
    COUNT(CASE WHEN d.created_at<=? THEN 1 END) AS review
    FROM customers c LEFT JOIN newsletter_deliveries d ON d.product_id=? AND d.customer_id=c.id
    WHERE c.verified_at IS NOT NULL AND c.newsletter_at IS NOT NULL AND d.sent_at IS NULL`)
    .bind(now-23*3600,now-23*3600,product.id).first();
  return json({sent,failed,remaining,review});
}
