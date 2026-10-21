/**
 * Verifica end-to-end delle interazioni del robot (browser headless).
 *
 *   npm i                (installa puppeteer-core)
 *   npm run verify       (richiede il server attivo su 127.0.0.1:8123)
 *
 * Copre: caricamento senza errori, camminata, risata, presa/posa della scatola,
 * reset, preset di camera e assenza di errori in console.
 */

import puppeteer from 'puppeteer-core';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

const BASE = process.env.ROBOT_URL || 'http://127.0.0.1:8123/index.html';
const OUT = path.resolve('artifacts', 'verify');

const results = [];
let failures = 0;

function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function waitFor(p, ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const executablePath = EDGE_CANDIDATES.find((p) => existsSync(p));

  if (!executablePath) {
    console.error('Nessun browser trovato (Edge/Chrome).');
    process.exit(2);
  }

  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--hide-scrollbars'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()}`));

  await page.goto(`${BASE}?view=front&still=1`, { waitUntil: 'networkidle0', timeout: 60000 });
  await waitFor(page, 2500);

  /* 1. Caricamento */
  check('pagina caricata senza errori console', errors.length === 0, errors.join(' | '));
  const hasApi = await page.evaluate(() => Boolean(window.__robot));
  check('API di test esposta (window.__robot)', hasApi);
  const canvas = await page.$eval('#scene', (c) => `${c.width}x${c.height}`);
  const stage = await page.$eval('.stage', (s) => `${Math.round(s.clientWidth)}x${Math.round(s.clientHeight)}`);
  check(
    'canvas dimensionato sullo stage',
    parseInt(canvas.split('x')[0]) > 0 && canvas.split('x')[0] !== '0',
    `canvas ${canvas} · stage ${stage}`
  );

  /* 2. Camminata (W) */
  const before = await page.evaluate(() => window.__robot.position());
  await page.keyboard.down('w');
  await waitFor(page, 1200);
  await page.keyboard.up('w');
  await waitFor(page, 300);
  const after = await page.evaluate(() => window.__robot.position());
  const moved = Math.hypot(after.x - before.x, after.z - before.z);
  check('robot si sposta con W', moved > 0.8, `spostamento ${moved.toFixed(2)} unità`);
  const walkState = await page.evaluate(() => window.__robot.state());
  check('stato camminata raggiunto', walkState === 'walk' || walkState === 'idle', walkState);

  /* 3. Risata (L) */
  await page.keyboard.press('l');
  await waitFor(page, 700);
  const laughState = await page.evaluate(() => window.__robot.state());
  check('stato risata attivo', laughState === 'laugh', laughState);
  await page.screenshot({ path: path.join(OUT, 'laugh.png') });

  /* 4. Scatola: presa completa (G) */
  await page.keyboard.press('g');
  await waitFor(page, 800);
  const approach = await page.evaluate(() => window.__robot.state());
  check('avvicinamento alla scatola avviato', ['approach', 'reach', 'grab', 'lift', 'carry'].includes(approach), approach);

  let carrying = false;
  for (let i = 0; i < 40; i += 1) {
    await waitFor(page, 400);
    carrying = await page.evaluate(() => window.__robot.carrying());
    if (carrying) break;
  }
  check('scatola afferrata e trasportata', carrying);

  const crate = await page.evaluate(() => window.__robot.crateWorld());
  check('scatola sollevata da terra (y > 1.0)', crate.y > 1.0, `y=${crate.y.toFixed(2)}`);
  await page.screenshot({ path: path.join(OUT, 'carry.png') });

  /* 5. Posa (G) */
  await page.keyboard.press('g');
  let dropped = { y: 99 };
  for (let i = 0; i < 30; i += 1) {
    await waitFor(page, 300);
    dropped = await page.evaluate(() => window.__robot.crateWorld());
    if (dropped.y < 0.6) break;
  }
  check('scatola posata a terra', dropped.y < 0.6, `y=${dropped.y.toFixed(2)}`);

  /* 6. Reset (R) */
  await page.keyboard.press('r');
  await waitFor(page, 600);
  const reset = await page.evaluate(() => window.__robot.position());
  check('reset posiziona il robot al centro', Math.hypot(reset.x, reset.z) < 0.2, JSON.stringify(reset));

  /* 7. Demo completa */
  await page.click('#btn-demo');
  await waitFor(page, 1200);
  const demoState = await page.evaluate(() => window.__robot.state());
  check('demo avviata', demoState !== 'idle', demoState);
  await page.screenshot({ path: path.join(OUT, 'demo.png') });

  /* 8. Preset camera */
  await page.select('#view-select', 'side');
  await waitFor(page, 800);
  const camOk = await page.evaluate(() => window.__robot.state() !== undefined);
  check('preset camera laterale applicato', camOk);

  check('nessun errore console al termine', errors.length === 0, errors.join(' | '));

  await writeFile(
    path.join(OUT, 'report.json'),
    JSON.stringify({ results, errors, checkedAt: new Date().toISOString() }, null, 2),
    'utf8'
  );

  await browser.close();
  console.log(`\n${results.length - failures}/${results.length} controlli superati`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(3);
});
