async function customerTickets(env, customerId) {
  const query = customerId
    ? 'SELECT id,order_id,subject,status,updated_at FROM support_tickets WHERE customer_id=? ORDER BY updated_at DESC LIMIT 50'
    : 'SELECT t.id,t.order_id,t.subject,t.status,t.updated_at,c.email FROM support_tickets t JOIN customers c ON c.id=t.customer_id ORDER BY t.status DESC,t.updated_at DESC LIMIT 100';
  const rows = (await env.DB.prepare(query).bind(...(customerId?[customerId]:[])).all()).results;
  if (!rows.length) return [];
  const placeholders = rows.map(()=>'?').join(',');
  const messages = (await env.DB.prepare('SELECT * FROM support_messages WHERE ticket_id IN ('+placeholders+') ORDER BY id')
    .bind(...rows.map(ticket=>ticket.id)).all()).results;
  const grouped = new Map(rows.map(ticket=>[ticket.id,[]]));
  for (const message of messages) grouped.get(message.ticket_id).push(message);
  return rows.map(ticket=>({...ticket,messages:grouped.get(ticket.id)}));
}

async function createCustomerTicket(env,customer,input) {
  const subject = text(input.subject,120);
  const message = text(input.message,4000);
  if (!subject || !message) fail('Renseigne le sujet et ton message.');
  const order = input.orderId ? await clientOrderRow(env,customer.id,input.orderId) : null;
  await customerLimit(env,'new-ticket',customer.id,8,3600);
  const id = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO support_tickets (id,customer_id,order_id,subject) VALUES (?,?,?,?)').bind(id,customer.id,order?.id ?? null,subject),
    env.DB.prepare("INSERT INTO support_messages (ticket_id,sender,message) VALUES (?,'customer',?)").bind(id,message)
  ]);
  return json({id},201);
}

async function replyToTicket(env,input,customer) {
  const {id} = input;
  const message = text(input.message,4000);
  if (typeof id!=='string' || !idPattern.test(id) || !message) fail('Renseigne ton message.');
  const scope = customer ? ' AND customer_id=?' : '';
  const args = customer ? [id,customer.id] : [id];
  if (customer) await customerLimit(env,'ticket-reply',customer.id,25,3600);
  const result = await env.DB.batch([
    env.DB.prepare("INSERT INTO support_messages (ticket_id,sender,message) SELECT id,?,? FROM support_tickets WHERE id=? AND status='open'"+scope)
      .bind(customer?'customer':'shop',message,...args),
    env.DB.prepare("UPDATE support_tickets SET updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='open'"+scope).bind(...args)
  ]);
  if (!result[0].meta.changes) fail('Ticket fermé ou introuvable.',404);
  return json({ok:true});
}

async function setTicketStatus(request,env) {
  const {id,status} = await body(request,1024);
  if (typeof id!=='string' || !idPattern.test(id) || !['open','closed'].includes(status)) fail('Ticket invalide.');
  const result = await env.DB.prepare('UPDATE support_tickets SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(status,id).run();
  if (!result.meta.changes) fail('Ticket introuvable.',404);
  return json({ok:true});
}

async function newsletterSubscribers(env) {
  const {results} = await env.DB.prepare('SELECT email,newsletter_at FROM customers WHERE newsletter_at IS NOT NULL AND verified_at IS NOT NULL ORDER BY newsletter_at').all();
  return results;
}

async function newsletterExport(env) {
  const rows = await newsletterSubscribers(env);
  const csv = rows.map(({email,newsletter_at})=>{
    const cell = /^[=+\-@]/.test(email) ? "'"+email : email;
    return '"'+cell.replaceAll('"','""')+'",'+new Date(newsletter_at*1000).toISOString();
  });
  return new Response(['email,consent_at',...csv].join('\r\n')+'\r\n',{headers:{
    'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="tsu-newsletter.csv"','Cache-Control':'no-store'
  }});
}
