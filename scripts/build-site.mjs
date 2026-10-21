/**
 * Assembla il sito statico in dist/ (output per Cloudflare Pages e GitHub Pages).
 *
 *   node scripts/build-site.mjs
 */

import { cp, mkdir, rm, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, '')), '..');
const DIST = path.join(ROOT, 'dist');

const FILES = ['index.html', 'robot.js', 'robot-actions.js', 'site.js', 'site.css'];
const DIRS = ['assets', 'vendor'];

async function dirSize(dir) {
  let total = 0;
  for (const entry of await (await import('node:fs/promises')).readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) total += await dirSize(p);
    else total += (await stat(p)).size;
  }
  return total;
}

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });

for (const file of FILES) {
  const src = path.join(ROOT, file);
  if (!existsSync(src)) throw new Error(`file mancante: ${file}`);
  await cp(src, path.join(DIST, file));
}

for (const dir of DIRS) {
  const src = path.join(ROOT, dir);
  if (!existsSync(src)) throw new Error(`cartella mancante: ${dir}`);
  await cp(src, path.join(DIST, dir), { recursive: true });
}

// Nessun processed Jekyll/underscore da interpretare
await writeFile(path.join(DIST, '.nojekyll'), '');

const bytes = await dirSize(DIST);
console.log(`dist/ pronto — ${FILES.length} file + ${DIRS.length} cartelle, ${(bytes / 1024 / 1024).toFixed(2)} MB`);
