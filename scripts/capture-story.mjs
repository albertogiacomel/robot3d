/**
 * Genera le immagini della sezione "storia" dalla scena reale.
 *
 *   node scripts/capture-story.mjs
 */

import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => existsSync(p));

const BASE = process.env.ROBOT_URL || 'http://127.0.0.1:8123/index.html';
const OUT = path.resolve('assets');
mkdirSync(OUT, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
await page.goto(`${BASE}?view=front&still=1`, { waitUntil: 'networkidle0' });
await wait(3000);

const stage = await page.$('.stage');
// L'HUD non deve comparire nelle immagini della storia
await page.evaluate(() => {
  const hud = document.querySelector('.hud');
  if (hud) hud.style.display = 'none';
});

// 02 - la geometria: robot fermo, in posa base
await stage.screenshot({ path: path.join(OUT, 'story-geometry.png') });

// 03 - il rig: ciclo di camminata in vista laterale
await page.select('#view-select', 'side');
await wait(900);
await page.keyboard.down('w');
await wait(1100);
await stage.screenshot({ path: path.join(OUT, 'story-rig.png') });
await page.keyboard.up('w');
await wait(400);

// 04 - il videogioco: raccolta e trasporto della scatola
await page.select('#view-select', 'front');
await wait(600);
await page.evaluate(() => window.__robot.actions.runDemo());
for (let i = 0; i < 90; i += 1) {
  await wait(250);
  const st = await page.evaluate(() => window.__robot.state());
  if (st === 'carry') break;
}
await wait(600);
await stage.screenshot({ path: path.join(OUT, 'story-game.png') });

await browser.close();
console.log('immagini della storia salvate in', OUT);
