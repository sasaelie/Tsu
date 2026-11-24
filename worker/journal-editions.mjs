function editionDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(+date) && date.toISOString().slice(0,10)===value;
}

function editionData(input) {
  if (!editionDate(input.week) || new Date(input.week).getUTCDay()!==1) fail('Indique le lundi de la semaine.');
  if (!Array.isArray(input.items) || input.items.length>10) fail('L’édition accepte jusqu’à dix sorties.');
  const items = input.items.map(entry=>{
    if (!entry || typeof entry!=='object') fail('Sortie invalide.');
    const title=text(entry.title,150);
    const source=safePhoto(text(entry.source,1000));
    const dates=editionDate(entry.date);
    if (!title || !source || !dates || !['manga','anime'].includes(entry.kind)) fail('Chaque sortie requiert un titre, une date, un type et un lien HTTPS.');
    return {title,source,date:entry.date,kind:entry.kind,noteFr:text(entry.noteFr,550),noteEn:text(entry.noteEn,550)};
  });
  const seen=new Set();
  for (const item of items) {
    const key=[item.kind,item.title.toLowerCase(),item.date].join('|');
    if (seen.has(key)) fail('Une sortie apparaît deux fois.');
    seen.add(key);
  }
  return {week:input.week,introFr:text(input.introFr,1000),introEn:text(input.introEn,1000),items};
}

const editionRow = row => row && ({...JSON.parse(row.data),publishedAt:row.published_at,updatedAt:row.updated_at});
async function getEdition(env,week,publicOnly=false) {
  return editionRow(await env.DB.prepare('SELECT data,published_at,updated_at FROM journal_editions WHERE week=?'+
    (publicOnly?' AND published_at IS NOT NULL':'')).bind(week).first());
}
async function listEditions(env,publicOnly=false) {
  const result=await env.DB.prepare('SELECT data,published_at,updated_at FROM journal_editions'+
    (publicOnly?' WHERE published_at IS NOT NULL':'')+' ORDER BY week DESC'+(publicOnly?'':' LIMIT 52')).bind().all();
  return result.results.map(editionRow);
}

async function saveEdition(env,input,automated=false) {
  const data=editionData(input);
  const update=automated?'DO NOTHING':'DO UPDATE SET data=excluded.data,updated_at=CURRENT_TIMESTAMP WHERE journal_editions.published_at IS NULL';
  const saved=await env.DB.prepare('INSERT INTO journal_editions (week,data) VALUES (?,?) ON CONFLICT(week) '+update)
    .bind(data.week,JSON.stringify(data)).run();
  if (!automated && !saved.meta.changes) fail('Cette édition est déjà publiée.',409);
  return {saved:Boolean(saved.meta.changes),edition:await getEdition(env,data.week)};
}

async function publishEdition(env,week) {
  const edition=editionDate(week) ? await getEdition(env,week) : null;
  if (!edition) fail('Édition introuvable.',404);
  if (!edition.items.length) fail('Ajoute au moins une sortie confirmée avant de publier.');
  await env.DB.prepare('UPDATE journal_editions SET published_at=COALESCE(published_at,CURRENT_TIMESTAMP) WHERE week=?')
    .bind(week).run();
  return getEdition(env,week);
}

const editionPath=week=>'/blog/veille-'+week;
const editionEnglishPath=week=>'/en/blog/watch-'+week;
const editionTitle=(week,en)=>local(en,'Les sorties manga et anime du ','Manga and anime releases from ')+mangaDate(week,en);
const editionList=(editions,en)=>'<ul class="release-list">'+editions.map(d=>'<li>'+
  navLink(editionPath(d.week),en,editionTitle(d.week,false),editionTitle(d.week,true))+'</li>').join('')+'</ul>';

function editionEditorial(edition,en) {
  const sections=['manga','anime'].map(kind=>{
    const label=kind==='manga'?local(en,'Parutions manga francophones','French-language manga releases'):local(en,'Diffusions anime repérées','Listed anime broadcasts');
    const items=edition.items.filter(item=>item.kind===kind).sort((a,b)=>a.date.localeCompare(b.date));
    if (!items.length) return '';
    return '<section><h2>'+label+'</h2><ul class="release-list">'+items.map(item=>'<li><time datetime="'+item.date+'">'+mangaDate(item.date,en)+'</time> · <strong>'+
      htmlEscape(item.title)+'</strong><p>'+htmlEscape(local(en,item.noteFr,item.noteEn) || item.noteFr || item.noteEn)+
      '</p>'+externalEditorialLink(local(en,'Source de la date · ','Release source · ')+new URL(item.source).hostname.replace(/^www[.]/,''),item.source)+(item.also?.length?' · '+externalEditorialLink(local(en,'Autre calendrier','Second calendar'),item.also[0]):'')+'</li>').join('')+'</ul></section>';
  }).join('');
  const intro=local(en,edition.introFr,edition.introEn) || edition.introFr || edition.introEn;
  return '<p class="article-meta">'+navLink('/blog/archives',en,'Archives du journal','Journal archive')+'</p>'+
    (intro?'<p class="editorial-lead">'+htmlEscape(intro)+'</p>':'')+journalFigure(journalImages.watch,en,true)+sections+
    (edition.focus?'<p>'+navLink(focusPath(edition.week),en,'Lire le dossier de la semaine','Read the weekly spotlight')+'</p>':'')+
    '<p>'+externalEditorialLink(local(en,'Vérifier les simulcasts sur Crunchyroll','Check simulcasts on Crunchyroll'),'https://www.crunchyroll.com/fr/simulcasts')+'</p>'+
    '<p class="editorial-signature" lang="fr">Tu n’auras pas vu mon site pour rien.</p>';
}

const editionTool={
  name:'save_journal_watch_draft',
  description:'Enregistrer une nouvelle veille TSŪ en brouillon pour un lundi donné. Une édition existante reste intacte.',
  inputSchema:{type:'object',additionalProperties:false,required:['week','items'],properties:{
    week:{type:'string',description:'Lundi de référence au format YYYY-MM-DD'},
    introFr:{type:'string'},introEn:{type:'string'},
    items:{type:'array',maxItems:10,items:{type:'object',additionalProperties:false,required:['title','kind','date','source'],properties:{
      title:{type:'string'},kind:{type:'string',enum:['manga','anime']},date:{type:'string'},
      source:{type:'string'},noteFr:{type:'string'},noteEn:{type:'string'}
    }}}
  }}
};

async function journalMcp(request,env) {
  const message=await body(request,26000);
  const response=result=>json({jsonrpc:'2.0',id:message.id??null,result});
  if (message.method==='server/discover') return response({supportedVersions:['2026-07-28'],capabilities:{tools:{}}});
  if (message.method==='tools/list') return response({tools:[editionTool]});
  if (message.method==='tools/call' && message.params?.name===editionTool.name) {
    const account=await ownerRecord(env);
    const subject=request.headers.get('oai-authenticated-user-id');
    const email=normalizedEmail(request.headers.get('oai-authenticated-user-email'));
    if (!account || !subject || subject!==account.subject ||
        !email || email!==normalizedEmail(account.email)) return response({isError:true,content:[{type:'text',text:'Accès propriétaire TSŪ requis.'}]});
    try {
      const result=await saveEdition(env,message.params.arguments??{},true);
      return response({content:[{type:'text',text:JSON.stringify({saved:result.saved,week:result.edition.week,published:Boolean(result.edition.publishedAt)})}]});
    } catch(error) {
      return response({isError:true,content:[{type:'text',text:error.status?error.message:'Le brouillon n’a pas pu être enregistré.'}]});
    }
  }
  return json({jsonrpc:'2.0',id:message.id??null,error:{code:-32601,message:'Méthode inconnue.'}});
}
