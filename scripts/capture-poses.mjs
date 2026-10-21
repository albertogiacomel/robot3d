/**
 * Cattura i fotogrammi chiave delle animazioni (reach, rise, carry, laugh).
 *
 *   node scripts/capture-poses.mjs
 */

import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => existsSync(p));

const BASE = process.env.ROBOT_URL || 'http://127.0.0.1:8123/index.html';
const OUT = path.resolve('artifacts', 'poses');
mkdirSync(OUT, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.goto(`${BASE}?view=front&still=1`, { waitUntil: 'networkidle0' });
await wait(2000);

// Risata (3 fotogrammi consecutivi)
await page.keyboard.press('l');
await wait(900);
await page.screenshot({ path: path.join(OUT, 'laugh.png') });
await wait(220);
await page.screenshot({ path: path.join(OUT, 'laugh-2.png') });
await wait(220);
await page.screenshot({ path: path.join(OUT, 'laugh-3.png') });
await wait(1900);

// Presa della scatola: cattura le fasi
const seen = {};
await page.keyboard.press('g');
let shot = 0;
for (let i = 0; i < 60; i += 1) {
  await wait(250);
  const st = await page.evaluate(() => window.__robot.state());
  if (['approach', 'reach', 'grab', 'lift', 'carry'].includes(st) && !seen[st]) {
    seen[st] = true;
    await page.screenshot({ path: path.join(OUT, `${st}.png`) });
  }
  if (st === 'carry') break;
}

// Camera ravvicinata sulla scatola
await page.evaluate(() => {
  window.__robot.actions && null;
});
await page.screenshot({ path: path.join(OUT, 'carry-front.png') });

// Ciclo di camminata (3 fotogrammi consecutivi)
await page.keyboard.press('r');
await wait(600);
await page.keyboard.down('w');
await wait(700);
await page.screenshot({ path: path.join(OUT, 'walk-1.png') });
await wait(230);
await page.screenshot({ path: path.join(OUT, 'walk-2.png') });
await wait(230);
await page.screenshot({ path: path.join(OUT, 'walk-3.png') });
await page.keyboard.up('w');

// Saluto
await page.keyboard.press(' ');
await wait(500);
await page.screenshot({ path: path.join(OUT, 'wave.png') });

await browser.close();
console.log('pose catturate in', OUT);
