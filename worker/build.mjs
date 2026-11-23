import { mkdirSync, readFileSync, writeFileSync, cpSync } from 'node:fs';

mkdirSync('dist/server', { recursive: true });
mkdirSync('dist/.openai', { recursive: true });
cpSync('.openai/hosting.json', 'dist/.openai/hosting.json');
cpSync('drizzle', 'dist/drizzle', { recursive: true });

const assets = Object.fromEntries([
  ['/', 'dist/index.html', 'text/html; charset=utf-8'],
  ['/style.css', 'dist/style.css', 'text/css; charset=utf-8'],
  ['/shop.js', 'dist/shop.js', 'text/javascript; charset=utf-8'],
  ['/room.webp', 'dist/room.webp', 'image/webp'],
  ['/admin', 'admin/index.html', 'text/html; charset=utf-8'],
  ['/admin/style.css', 'admin/style.css', 'text/css; charset=utf-8'],
  ['/admin/index.js', 'admin/index.js', 'text/javascript; charset=utf-8']
].map(([url, file, type]) => [url, [type, readFileSync(file).toString('base64')]]));

writeFileSync('dist/server/index.js', 'const assets = ' + JSON.stringify(assets) + ';\n' + readFileSync('worker/index.mjs','utf8'));
