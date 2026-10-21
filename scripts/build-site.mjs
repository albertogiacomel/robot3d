/**
 * Assembla il sito statico in dist/ (output per Cloudflare Pages e GitHub Pages).
 *
 *   node scripts/build-site.mjs
 */

import { cp, mkdir, rm, writeFile, stat, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

// import.meta.dirname e Node >= 20.11 (CI: Node 22, locale: Node 26)
const ROOT = resolve(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');

const FILES = ['index.html', 'robot.js', 'robot-actions.js', 'site.js', 'site.css'];
const DIRS = ['assets', 'vendor'];

async function dirSize(dir) {
  let total = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) total += await dirSize(p);
    else total += (await stat(p)).size;
  }
  return total;
}

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });

for (const file of FILES) {
  const src = join(ROOT, file);
  if (!existsSync(src)) throw new Error(`file mancante: ${file}`);
  await cp(src, join(DIST, file));
}

for (const dir of DIRS) {
  const src = join(ROOT, dir);
  if (!existsSync(src)) throw new Error(`cartella mancante: ${dir}`);
  await cp(src, join(DIST, dir), { recursive: true });
}

// Nessun processed Jekyll/underscore da interpretare
await writeFile(join(DIST, '.nojekyll'), '');

const bytes = await dirSize(DIST);
console.log(`dist/ pronto — ${FILES.length} file + ${DIRS.length} cartelle, ${(bytes / 1024 / 1024).toFixed(2)} MB`);

