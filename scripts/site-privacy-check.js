import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve,  join  } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const publicRoot = join(root, 'public');
const directory = join(publicRoot, 'site-privacy');
const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
assert.match(manifest.source.commit, /^[a-f0-9]{40}$/);
for (const entry of manifest.files) {
  assert.ok(/^(?:[a-z0-9_.-]+|fonts\/(?:inter-latin\.woff2|OFL\.txt|provenance\.json)|vendor\/klaro-0\.7\.21\/[a-z0-9_.-]+)$/i.test(entry.path) && !entry.path.includes('..'), 'Safe privacy path');
  const data = await readFile(join(directory, entry.path));
  assert.equal(data.length, entry.bytes, entry.path + ' length');
  assert.equal(createHash('sha256').update(data).digest('hex'), entry.sha256, entry.path + ' hash');
}
const policy = await readFile(join(publicRoot, 'privacy.html'), 'utf8');
assert.equal(policy.replaceAll('\r\n', '\n'), (await readFile(join(directory, 'privacy.html'), 'utf8')).replaceAll('\r\n', '\n'));
const ads = await readFile(join(publicRoot, 'ads.txt'), 'utf8');
assert.ok(ads.split(/\r?\n/).includes('google.com, pub-8896739816580918, DIRECT, f08c47fec0942fa0'));
const entry = await readFile(join(root, 'index.html'), 'utf8');
assert.ok(entry.includes('site-privacy/runtime.js') && entry.includes('data-site-profile'), 'Privacy script integrated');
assert.doesNotMatch(entry, /<amp-auto-ads|<script[^>]+src="https:\/\/pagead2\.googlesyndication/i, 'No AMP or unconditional advertising loader');
assert.doesNotMatch(entry, /<link[^>]*\shref="https:\/\/fonts\.googleapis/i, 'Google fonts require a privacy choice');
const bytes = manifest.files.reduce((n, file) => n + file.bytes, 0);
assert.ok(bytes <= 350000, 'Optional privacy bundle exceeds 350,000 bytes (includes the locally hosted homepage Inter font)');
console.log('PASS site privacy ' + manifest.version + ': ' + manifest.files.length + ' pinned assets, ' + bytes + ' bytes; ads.txt, policy and opt-in integration');
