import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import app from '../dist/server/index.js';

test('les éditions successives restent accessibles dans les archives et flux RSS FR et EN', async (t) => {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  const migrations = new URL('../drizzle/', import.meta.url);
  for (const migration of readdirSync(migrations).sort()) {
    db.exec(readFileSync(new URL(migration, migrations), 'utf8'));
  }
  const prepare = (sql, args = []) => ({
    bind: (...next) => prepare(sql, next),
    first: async () => db.prepare(sql).get(...args),
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => ({ meta: db.prepare(sql).run(...args) })
  });
  const env = {
    DB: { prepare }, TSU_WATCH_URL: 'https://watch.example.test/',
    TSU_WATCH_READ_TOKEN: 'local-test-secret'
  };
  const weeks = ['2026-11-30', '2026-11-23'];
  const news = weeks.map(week => ({
    week, published_at: week+'T07:00:00Z', contents: {
      week, introFr: 'Les sorties de la semaine.', introEn: 'This week’s releases.',
      items: [{ kind: 'anime', title: 'Série de test', date: week, source: 'https://guide.example.test/' }]
    }
  }));
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (new URL(url).hostname === 'apihub.agnes-ai.com') {
      const request=JSON.parse(options.body);
      assert.equal(request.model,'agnes-2.5-flash');
      const content=request.max_tokens===96?'OK':JSON.stringify({
        titleFr:'Brouillon Agnès',seoFr:'Résumé du brouillon',bodyFr:'Première proposition française.'
      });
      return Response.json({choices:[{finish_reason:'stop',message:{content}}]});
    }
    assert.equal(options.headers['x-tsu-watch-token'], env.TSU_WATCH_READ_TOKEN);
    const requestedWeek = new URL(url).searchParams.get('week');
    return Response.json(requestedWeek
      ? {publication: news.find(item => item.week===requestedWeek) ?? null}
      : {publications: news.map(({week,published_at}) => ({week,published_at}))});
  });
  const read = async (path) => {
    const r = await app.fetch(new Request('https://tsu.example.test'+path), env);
    assert.equal(r.status, 200, path);
    return r.text();
  };
  for (const [archive, rss, prefix] of [
    ['/blog/archives', '/blog/rss.xml', '/blog/veille-'],
    ['/en/blog/archive', '/en/blog/feed.xml', '/en/blog/watch-']
  ]) {
    const archiveHtml = await read(archive);
    const feed = await read(rss);
    for (const week of weeks) {
      const path = prefix + week;
      assert.ok(archiveHtml.includes('href="'+path+'"'));
      assert.ok(feed.includes('<guid isPermaLink="true">https://tsu.example.test'+path+'</guid>'));
      assert.match(await read(path), /Série de test/);
    }
    assert.ok(feed.indexOf(prefix+weeks[0]) < feed.indexOf(prefix+weeks[1]));
  }
  const article = {
    titleFr: 'Journal de test', bodyFr: 'Source (https://editeur.example.test/fiche).',
    titleEn: '', seoFr: '', bodyEn: ''
  };
  db.prepare('INSERT INTO journal_articles(slug,draft,published,published_at) VALUES (?,?,?,CURRENT_TIMESTAMP)')
    .run('essai',JSON.stringify(article),JSON.stringify(article));
  assert.match(await read('/blog/article-essai'), /href="https:\/\/editeur\.example\.test\/fiche"/);
  assert.ok(!(await read('/en/blog/feed.xml')).includes('article-essai'));
  const selection = await read('/blog/5-mangas-novembre-2026');
  for (const slug of ['spy-x-family','les-carnets-de-lapothicaire','latelier-des-sorciers','alice-in-borderland']) {
    for (const region of ['be','fr']) assert.ok(selection.includes('https://www.justwatch.com/'+region+'/serie/'+slug));
  }

  const sessionToken = 'a'.repeat(64);
  db.prepare("INSERT INTO tsu_owner(id,subject,email,salt,password_hash) VALUES(1,'owner','owner@example.test','fixture','fixture')").run();
  db.prepare('INSERT INTO tsu_sessions VALUES (?,?)').run(
    createHash('sha256').update(sessionToken).digest('hex'), Math.floor(Date.now()/1000)+1800);
  env.TSU_AI_ENCRYPTION_KEY = 'b'.repeat(64);
  const post = async (endpoint, data) => {
    const origin='https://tsu.example.test';
    const response=await app.fetch(new Request(origin+'/api/admin/'+endpoint,{
      method:'POST',headers:{origin,'content-type':'application/json','oai-authenticated-user-id':'owner',
        'oai-authenticated-user-email':'owner@example.test',cookie:'__Host-tsu_session='+sessionToken},
      body:JSON.stringify(data)
    }),env);
    const json=await response.json();
    assert.equal(response.status,200,endpoint+': '+JSON.stringify(json));
    return json;
  };
  await post('editorial-ai',{model:'agnes-2.5-flash',key:'fake-secret-agnes-local'});
  const proposal=await post('editorial-ai/generate',{action:'write',brief:'Rédige un article français sur la broderie.'});
  assert.equal(proposal.fields.bodyFr,'Première proposition française.');
  await post('journal/articles',{slug:'brouillon-agnes',...proposal.fields,publish:false});
  assert.equal(db.prepare('SELECT published FROM journal_articles WHERE slug=?').get('brouillon-agnes').published,null);
  assert.ok(!(await read('/blog/rss.xml')).includes('brouillon-agnes'));
});
