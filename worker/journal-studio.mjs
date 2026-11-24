const journalArticlePath=slug=>'/blog/article-'+slug;

function journalArticleRow(row,publicOnly) {
  return row && {slug:row.slug,...JSON.parse(publicOnly?row.published:row.draft),
    publishedAt:row.published_at,updatedAt:row.updated_at};
}
async function journalArticles(env,publicOnly=false) {
  const rows=await env.DB.prepare('SELECT slug,draft,published,published_at,updated_at FROM journal_articles'+
    (publicOnly?' WHERE published IS NOT NULL':'')+' ORDER BY updated_at DESC').all();
  return rows.results.map(row=>journalArticleRow(row,publicOnly));
}
async function journalArticle(env,slug) {
  return journalArticleRow(await env.DB.prepare(
    'SELECT slug,published,published_at,updated_at FROM journal_articles WHERE slug=? AND published IS NOT NULL'
  ).bind(slug).first(),true);
}
async function saveJournalArticle(env,input) {
  const slug=text(input.slug,81);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length>80) fail('Utilise un identifiant de lien de 80 caractères maximum, avec lettres minuscules, chiffres et tirets.');
  const draft=articleCopy(input);
  if (!draft.titleFr) fail('Indique un titre français.');
  const publish=input.publish===true;
  if (publish && !draft.bodyFr) fail('Ajoute le texte français avant de publier.');
  const serialized=JSON.stringify(draft);
  if (input.existing===true) {
    const result=await env.DB.prepare('UPDATE journal_articles SET draft=?,updated_at=CURRENT_TIMESTAMP,'+
      'published=CASE WHEN ? THEN ? ELSE published END,published_at=CASE WHEN ? THEN COALESCE(published_at,CURRENT_TIMESTAMP) ELSE published_at END WHERE slug=?')
      .bind(serialized,publish?1:0,serialized,publish?1:0,slug).run();
    if (!result.meta.changes) fail('Article introuvable.',404);
  } else {
    const result=await env.DB.prepare('INSERT INTO journal_articles(slug,draft,published,published_at) '+
      'VALUES (?,?,?,CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE NULL END) ON CONFLICT(slug) DO NOTHING')
      .bind(slug,serialized,publish?serialized:null,publish?1:0).run();
    if (!result.meta.changes) fail('Ce lien est déjà utilisé. Ouvre l’article existant ou choisis un autre lien.',409);
  }
  return {slug,published:publish};
}

async function journalWatch(env) {
  if (!env.TSU_WATCH_URL || !env.TSU_WATCH_READ_TOKEN) return {configured:false,drafts:[],runs:[],published:[]};
  const [result,published]=await Promise.all([watchResponse(env),syndicatedJournal(env)]);
  if (!Array.isArray(result?.drafts)||!Array.isArray(result?.runs)) fail('La veille Supabase est momentanément indisponible.',502);
  return {configured:true,drafts:result.drafts,runs:result.runs,published};
}
async function importJournalWatch(env,week) {
  const {drafts}=await journalWatch(env);
  const draft=drafts.find(item=>item.week===week);
  if (!draft) fail('Brouillon Supabase introuvable.',404);
  return saveEdition(env,draft.contents,true);
}
