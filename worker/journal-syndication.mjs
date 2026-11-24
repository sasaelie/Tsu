const focusPath = week=>'/blog/dossier-'+week;
const focusEnglishPath = week=>'/en/blog/spotlight-'+week;
const journalFeedPath = en=>en?'/en/blog/feed.xml':'/blog/rss.xml';

async function watchResponse(env,query={}) {
  if (!env.TSU_WATCH_URL || !env.TSU_WATCH_READ_TOKEN) return null;
  try {
    const url=new URL(env.TSU_WATCH_URL);
    for (const [key,value] of Object.entries(query)) url.searchParams.set(key,value);
    const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(5000),
      headers:{'x-tsu-watch-token':env.TSU_WATCH_READ_TOKEN}});
    if (response.ok) return await response.json();
  } catch {}
  return null;
}

async function syndicatedJournal(env,week) {
  const data=await watchResponse(env,{view:'published',...(week ? {week} : {})});
  if (week) {
    const row=data?.publication;
    return row ? {...row.contents,week:row.week,publishedAt:row.published_at} : null;
  }
  return Array.isArray(data?.publications)
    ? data.publications.map(row=>({week:row.week,publishedAt:row.published_at,focus:row.focus})) : [];
}

function combineEditions(manual,weekly) {
  const editions=new Map(weekly.map(edition=>[edition.week,edition]));
  for (const edition of manual) editions.set(edition.week,{...editions.get(edition.week),...edition});
  return [...editions.values()].sort((a,b)=>b.week.localeCompare(a.week));
}

function focusTitle(focus,en) {
  const title=focus.release.title;
  if (focus.format==='watch') return local(en,title+' : date de diffusion et où vérifier en Belgique',title+': air date and where to check in Belgium');
  if (focus.format==='start') return local(en,'Commencer '+title+' : date de sortie et édition VF','Start '+title+': French edition and release date');
  return local(en,title+' : ce qui sort en français',title+': what is coming out in French');
}

function focusDescription(focus,en) {
  const title=focus.release.title;
  return focus.format==='watch'
    ? local(en,'La date repérée pour '+title+' et les catalogues à consulter pour vérifier sa disponibilité en Belgique.',
      'The listed air date for '+title+' and the catalogues to check for Belgian availability.')
    : local(en,'Date, fiche du tome et repères pour situer la sortie francophone de '+title+' dans la série.',
      'Release date, volume listing and reading context for the French edition of '+title+'.');
}

function focusArticle(edition,en) {
  const {focus}=edition;
  const {release}=focus;
  const watch=focus.format==='watch';
  const advice=watch
    ? local(en,'La date correspond à la diffusion repérée au Japon. En Belgique, cherche la série dans le catalogue du diffuseur, puis vérifie la saison, le numéro d’épisode et la langue. Un créneau japonais ne confirme pas un simulcast belge.',
      'The listed date is for Japan. In Belgium, look up the series with the streaming service and check the season, episode number and language. A Japanese broadcast does not confirm a Belgian simulcast.')
    : focus.format==='start'
      ? local(en,'La fiche indique un premier tome ou un volume indépendant. Vérifie le titre, l’éditeur et le numéro avant de commander. Pour choisir entre la VF papier et numérique, compare les fiches de ton libraire.',
        'The listing indicates a first or standalone volume. Check the title, publisher and volume number before ordering. Compare listings if you are deciding between print and digital.')
      : local(en,'La parution concerne le volume indiqué dans la fiche. Si tu découvres la série, retrouve d’abord le tome 1 de la même édition. Compare aussi la couverture et l’ISBN en cas de réédition ou de collector.',
        'The release is for the listed volume. If you are new to the series, find volume one of the same edition first. Check the cover and ISBN if the series has a reprint or collector’s edition.');
  const primary=externalEditorialLink(local(en,'Consulter la fiche source','Open the source listing'),release.source);
  const additional=(release.also??[]).concat(focus.context?.source?[focus.context.source]:[]).map(url=>
    '<li>'+externalEditorialLink(new URL(url).hostname.replace(/^www[.]/,''),url)+'</li>').join('');
  return '<p class="editorial-lead">'+htmlEscape(focusDescription(focus,en))+'</p>'+
    journalFigure(journalImages.watch,en,true)+
    '<h2>'+local(en,'Date annoncée et source','Listed date and source')+'</h2><p><time datetime="'+release.date+'">'+mangaDate(release.date,en)+'</time> · '+primary+'</p>'+
    '<h2>'+local(en,'Le repère TSŪ','The TSŪ guide')+'</h2><p>'+advice+'</p>'+
    (watch?'<p>'+externalEditorialLink(local(en,'Consulter les simulcasts de Crunchyroll','Check Crunchyroll simulcasts'),'https://www.crunchyroll.com/fr/simulcasts')+'</p>':'')+
    (additional?'<h2>'+local(en,'Autres références','Related sources')+'</h2><ul class="editorial-sources">'+additional+'</ul>':'')+
    '<p>'+navLink(editionPath(edition.week),en,'Voir toutes les sorties de la semaine','See all releases this week')+'</p>'+
    '<p class="editorial-signature" lang="fr">Tu n’auras pas vu mon site pour rien.</p>';
}

function focusList(editions,en) {
  const entries=editions.filter(edition=>edition.focus).map(({week,focus})=>
    '<li>'+navLink(focusPath(week),en,htmlEscape(focusTitle(focus,false)),htmlEscape(focusTitle(focus,true)))+'</li>');
  return entries.length ? '<ul class="release-list">'+entries.join('')+'</ul>' : '';
}

async function journalRSS(origin,en,env,headers) {
  const [manual,weekly,articles]=await Promise.all([listEditions(env,true),syndicatedJournal(env),journalArticles(env,true)]);
  const editions=combineEditions(manual,weekly);
  const entries=[
    ...journal.map(article=>({path:'/blog/'+article.slug,title:local(en,article.fr,article.en),
      description:local(en,article.descFr,article.descEn),date:'2026-11-23'})),
    ...articles.filter(item=>!en || (item.titleEn && item.bodyEn)).map(item=>({path:journalArticlePath(item.slug),
      title:local(en,item.titleFr,item.titleEn),description:local(en,item.seoFr,item.seoEn) || text(local(en,item.bodyFr,item.bodyEn),155),date:item.publishedAt})),
    ...editions.flatMap(({week,publishedAt,focus})=>[
      {path:editionPath(week),title:editionTitle(week,en),description:local(en,'Parutions manga VF et diffusions anime sourcées.','French manga releases and sourced anime broadcast dates.'),date:publishedAt},
      ...(focus?[{path:focusPath(week),title:focusTitle(focus,en),description:focusDescription(focus,en),date:publishedAt}]:[])
    ])
  ];
  const time=value=>Date.parse(String(value).replace(/^(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d)$/,'$1T$2Z'));
  const items=entries.filter(entry=>Number.isFinite(time(entry.date))).sort((a,b)=>time(b.date)-time(a.date)).slice(0,30).map(entry=>{
    const link=htmlEscape(origin+languagePath(entry.path,en));
    return '<item><title>'+htmlEscape(entry.title)+'</title><link>'+link+'</link><guid isPermaLink="true">'+link+
      '</guid><description>'+htmlEscape(entry.description)+'</description><pubDate>'+new Date(time(entry.date)).toUTCString()+'</pubDate></item>';
  }).join('');
  const self=origin+journalFeedPath(en);
  return new Response('<?xml version="1.0" encoding="utf-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>'+
    '<title>Journal TSŪ</title><link>'+htmlEscape(origin+languagePath('/blog',en))+'</link><description>'+
    local(en,'Sorties manga et anime, sélections et guides TSŪ.','Manga and anime releases, picks and TSŪ guides.')+
    '</description><language>'+local(en,'fr-BE','en')+'</language><atom:link href="'+htmlEscape(self)+'" rel="self" type="application/rss+xml"/>'+
    items+'</channel></rss>',{headers:{...headers,'Content-Type':'application/rss+xml; charset=utf-8'}});
}
