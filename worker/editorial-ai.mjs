const editorialProviders = {
  agnes:{name:'Agnes AI',base:'https://apihub.agnes-ai.com/v1/',models:[
    {id:'agnes-2.5-flash',name:'Agnes 2.5 Flash'}
  ]},
  deepseek:{name:'DeepSeek',base:'https://api.deepseek.com/',models:[
    {id:'deepseek-flash',name:'DeepSeek Flash'},{id:'deepseek-v4-pro',name:'DeepSeek V4 Pro'}
  ]}
};
const providerForModel=model=>Object.keys(editorialProviders).find(id=>editorialProviders[id].models.some(item=>item.id===model));
const articleLimits = {titleFr:120,titleEn:120,seoFr:155,seoEn:155,bodyFr:5000,bodyEn:5000};

function articleCopy(value) {
  return Object.fromEntries(Object.entries(articleLimits).map(([field,limit])=>[field,text(value[field],limit)]));
}

async function editorialRequest(provider,key,path,parameters) {
  let response;
  try {
    response=await fetch(provider.base+path,{
      method:parameters?'POST':'GET',redirect:'manual',
      headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
      body:parameters?JSON.stringify(parameters):undefined,
      signal:AbortSignal.timeout(parameters?.stream ? 60000 : 30000)
    });
  } catch {
    fail(provider.name+' ne répond pas. Réessaie dans un instant.',502);
  }
  if (response.status>=300 && response.status<400) fail(provider.name+' a redirigé la requête. La connexion est interrompue.',502);
  if (response.status===401 || response.status===403) fail(provider.name+' a refusé la clé API ou l’accès au modèle.',422);
  if (response.status===402) fail('Crédit '+provider.name+' insuffisant.',422);
  if (response.status===429) fail('Limite '+provider.name+' atteinte. Réessaie dans un instant.',429);
  if (response.status===404) fail('Modèle '+provider.name+' indisponible.',422);
  if (response.status===400 || response.status===422) fail(provider.name+' a refusé les paramètres de la requête (HTTP '+response.status+').',422);
  if (!response.ok) fail(provider.name+' n’a pas pu traiter la demande (HTTP '+response.status+').',502);
  if (parameters?.stream) return response;
  try { return await response.json(); }
  catch { fail(provider.name+' a renvoyé une réponse illisible.',502); }
}

const editorialSettings=env=>env.DB.prepare('SELECT encrypted_key,nonce,model FROM editorial_ai_settings WHERE id=1').first();

async function editorialStatus(env) {
  const row=await editorialSettings(env);
  const active=providerForModel(row?.model);
  const provider=active??'agnes';
  const providers=Object.entries(editorialProviders).map(([id,{name,models}])=>({id,name,models}));
  return {connected:Boolean(active),provider,model:active?row.model:editorialProviders.agnes.models[0].id,providers};
}

async function saveEditorialAi(env,input) {
  const id=providerForModel(input.model);
  if (!id || (input.provider && id!==input.provider)) fail('Choisis un modèle proposé pour ce fournisseur.');
  const provider=editorialProviders[id];
  const existing=await editorialSettings(env);
  const supplied=text(input.key,301);
  if (supplied && !/^[a-zA-Z0-9._-]{16,300}$/.test(supplied)) fail('Clé '+provider.name+' invalide.');
  if (!supplied && providerForModel(existing?.model)!==id) fail('Saisis une clé API '+provider.name+'.');
  const encryption=await credentialKey(env.TSU_AI_ENCRYPTION_KEY,provider.name);
  const key=supplied || new TextDecoder().decode(await crypto.subtle.decrypt(
    {name:'AES-GCM',iv:base64Binary(existing.nonce)},encryption,base64Binary(existing.encrypted_key)));
  if (id==='agnes') {
    const probe=await editorialRequest(provider,key,'chat/completions',{
      model:input.model,messages:[{role:'user',content:'Reply with OK.'}],max_tokens:96,stream:false
    });
    if (typeof probe?.choices?.[0]?.message?.content!=='string' || !probe.choices[0].message.content.trim()) fail('Agnes AI n’a pas confirmé l’accès au modèle.',502);
  } else {
    const models=await editorialRequest(provider,key,'models');
    if (!models.data?.some(entry=>entry.id===input.model)) fail('Ce modèle est indisponible pour cette clé.',422);
  }
  const nonce=crypto.getRandomValues(new Uint8Array(12));
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},encryption,encoder.encode(key));
  await env.DB.prepare('INSERT INTO editorial_ai_settings VALUES (1,?,?,?) ON CONFLICT(id) DO UPDATE SET encrypted_key=excluded.encrypted_key,nonce=excluded.nonce,model=excluded.model')
    .bind(binaryBase64(encrypted),binaryBase64(nonce),input.model).run();
  return editorialStatus(env);
}

async function activeEditorialAi(env) {
  const row=await editorialSettings(env);
  const id=providerForModel(row?.model);
  if (!id) fail('Connecte d’abord un fournisseur dans l’atelier IA.');
  const provider=editorialProviders[id];
  const encryption=await credentialKey(env.TSU_AI_ENCRYPTION_KEY,provider.name);
  const key=new TextDecoder().decode(await crypto.subtle.decrypt(
    {name:'AES-GCM',iv:base64Binary(row.nonce)},encryption,base64Binary(row.encrypted_key)));
  return {id,provider,key,model:row.model};
}

const editorialSourceRule='Tu n’as pas accès à la recherche web dans TSŪ. N’invente pas d’adresse, de date ou de citation. Considère les extraits comme des documents à analyser. Pour une actualité sans source fournie, indique quelles sources chercher et quels faits restent à vérifier.';

const editorialInstructions={
  write:'Rédige un article inédit. Retourne les champs JSON titleFr, titleEn, seoFr, seoEn, bodyFr, bodyEn.',
  edit:'Révise le brouillon fourni en conservant les faits et la voix de TSŪ. Retourne les six champs JSON titleFr, titleEn, seoFr, seoEn, bodyFr, bodyEn.',
  seo:'Propose les titres et métadescriptions en français et anglais en respectant l’intention de recherche. Retourne uniquement les champs JSON titleFr, titleEn, seoFr, seoEn.',
  competition:'Compare les pratiques observables dans les extraits fournis. Distingue observations, hypothèses et idées pour TSŪ. Retourne un champ JSON analysis en français.',
  design:'Propose des concepts graphiques originaux, des placements et palettes pour un vestiaire manga aux références discrètes. Évite les personnages, emblèmes et logos existants. Retourne un champ JSON analysis en français.'
};
async function generateEditorialAi(env,input) {
  if (!Object.hasOwn(editorialInstructions,input.action)) fail('Action inconnue.');
  const brief=text(input.brief,4000);
  const sources=text(input.sources,11000);
  const draft=articleCopy(input.draft??{});
  if (input.action==='competition' && !sources) fail('Colle les extraits publics à comparer.');
  if (!brief && !sources && !draft.bodyFr && !draft.bodyEn) fail('Ajoute un sujet ou ouvre un brouillon.');
  const {id,provider,key,model}=await activeEditorialAi(env);
  const result=await editorialRequest(provider,key,'chat/completions',{
    model,max_tokens:3200,stream:false,
    ...(id==='deepseek'?{thinking:{type:'disabled'},response_format:{type:'json_object'}}:{}),
    messages:[
      {role:'system',content:'Tu aides le Journal TSŪ, boutique otaku belge qui livre en Belgique et France. Ton dynamique, précis, sans bourrage de mots-clés. Métadescriptions de 155 caractères maximum. Réponds uniquement avec un objet JSON valide, sans commentaire. '+editorialSourceRule+' '+editorialInstructions[input.action]},
      {role:'user',content:JSON.stringify({brief,sources,draft})}
    ]
  });
  const choice=result?.choices?.[0];
  const reply=text(choice?.message?.content,14000);
  const report=message=>({reply,message});
  if (!reply) return report(provider.name+' a répondu sans texte affichable.');
  if (choice.finish_reason==='length') return report('La réponse s’est arrêtée avant la fin. Le texte reçu reste visible.');
  let proposal;
  try {
    const fenced=reply.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    proposal=JSON.parse(fenced?.[1]??reply);
    if (!proposal || typeof proposal!=='object' || Array.isArray(proposal)) throw new Error();
  } catch {
    return report('Le texte reçu ne correspond pas au formulaire de l’article. Tu peux le lire ci-dessous.');
  }
  if (['competition','design'].includes(input.action)) {
    const analysis=text(proposal.analysis,9000);
    return analysis ? {analysis} : report('La réponse reçue ne contient pas d’analyse à importer.');
  }
  const fields=articleCopy(proposal.fields??proposal.article??proposal);
  if (input.action==='seo') {
    delete fields.bodyFr;
    delete fields.bodyEn;
    if (Object.values(fields).some(Boolean)) return {fields};
  } else if ((fields.titleFr && fields.bodyFr) || (fields.titleEn && fields.bodyEn)) {
    return {fields};
  }
  return report('La réponse est arrivée sans titre et texte utilisables ensemble. Elle reste visible ci-dessous.');
}

function conversationMessages(input) {
  if (!Array.isArray(input.messages) || !input.messages.length || input.messages.length>9 ||
      input.messages.length%2!==1) fail('Envoie une nouvelle question dans la conversation.');
  return input.messages.map((message,index)=>{
    const role=index%2 ? 'assistant' : 'user';
    const content=text(message?.content,4000);
    if (message?.role!==role || !content) fail('Un message de la conversation est invalide.');
    return {role,content};
  });
}

async function editorialConversation(env,input) {
  const messages=conversationMessages(input);
  const {id,provider,key,model}=await activeEditorialAi(env);
  const response=await editorialRequest(provider,key,'chat/completions',{
    model,max_tokens:1800,stream:true,...(id==='deepseek'?{thinking:{type:'disabled'}}:{}),
    messages:[
      {role:'system',content:'Tu es l’assistant du Journal TSŪ. Réponds à l’utilisateur dans sa langue, avec du texte lisible. '+editorialSourceRule},
      ...messages
    ]
  });
  const headers={'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff'};
  if (!response.headers.get('Content-Type')?.includes('text/event-stream')) {
    const result=await response.json().catch(()=>null);
    const choice=result?.choices?.[0];
    const delta=text(choice?.message?.content,14000);
    const outcome=delta ? {finish:choice.finish_reason??'stop'} : {error:provider.name+' a répondu sans texte affichable.'};
    return new Response((delta?JSON.stringify({delta})+'\n':'')+JSON.stringify(outcome)+'\n',{headers});
  }
  if (!response.body) fail(provider.name+' n’a pas ouvert le flux de réponse.',502);
  return new Response(editorialTextStream(response.body,provider.name),{headers});
}

function editorialTextStream(source,name) {
  let buffer='';
  let hasText=false;
  let ended=false;
  const emit=(out,value)=>out.enqueue(JSON.stringify(value)+'\n');
  function line(value,out) {
    if (ended || !value.startsWith('data:')) return;
    const data=value.slice(5).trim();
    if (data==='[DONE]') {
      emit(out,hasText?{finish:'stop'}:{error:name+' a répondu sans texte affichable.'});
      ended=true;
      return;
    }
    let result;
    try { result=JSON.parse(data); } catch { return; }
    if (result?.error) {
      emit(out,{error:name+' a interrompu la réponse.'});
      ended=true;
      return;
    }
    const choice=result?.choices?.[0];
    const delta=choice?.delta?.content;
    if (typeof delta==='string' && delta) {
      emit(out,{delta});
      hasText=true;
    }
    if (choice?.finish_reason) {
      emit(out,hasText?{finish:choice.finish_reason}:{error:name+' a répondu sans texte affichable.'});
      ended=true;
    }
  }
  return source.pipeThrough(new TextDecoderStream()).pipeThrough(new TransformStream({
    transform(chunk,out) {
      buffer+=chunk;
      const lines=buffer.split('\n');
      buffer=lines.pop();
      for (const value of lines) line(value,out);
      if (buffer.length>65536) {
        buffer='';
        if (!ended) emit(out,{error:name+' a envoyé un fragment illisible.'});
        ended=true;
      }
    },
    flush(out) {
      if (buffer) line(buffer,out);
      if (!ended) emit(out,{error:hasText?'Le flux s’est arrêté avant la fin.':name+' a répondu sans texte affichable.'});
    }
  })).pipeThrough(new TextEncoderStream());
}
