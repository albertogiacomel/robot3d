/**
 * Cattura la sequenza della demo con la regia cinematografica attiva.
 *
 *   node scripts/capture-demo.mjs
 */

import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => existsSync(p));

const BASE = process.env.ROBOT_URL || 'http://127.0.0.1:8123/index.html';
const OUT = path.resolve('artifacts', 'demo');
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

await page.click('#btn-demo');

const seen = {};
for (let i = 0; i < 90; i += 1) {
  await wait(220);
  const st = await page.evaluate(() => window.__robot.state());
  if (!seen[st]) {
    seen[st] = true;
    await page.screenshot({ path: path.join(OUT, `${i}-${st}.png`) });
  }
  if (st === 'carry' && seen.carry) break;
}

await wait(1200);
await page.screenshot({ path: path.join(OUT, 'final-carry.png') });

await browser.close();
console.log('demo catturata in', OUT, Object.keys(seen).join(', '));
