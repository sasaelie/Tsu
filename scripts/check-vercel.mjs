// Guard against deploying the Sites Worker or its static dist/ as a Vercel storefront.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const edge = fileURLToPath(new URL('../api/index.mjs', import.meta.url));
if (!existsSync(edge)) {
  console.error('TSŪ : adaptateur Vercel absent. Le Worker actuel dépend de D1 et de l’identité signée par Sites. Voir MIGRATION-VERCEL.md.');
  process.exitCode = 1;
}
