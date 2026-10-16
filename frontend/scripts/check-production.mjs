import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const assetDirectory = new URL('../dist/assets/', import.meta.url);
const files = await readdir(assetDirectory);
for (const name of files.filter((name) => name.endsWith('.js'))) {
  const contents = await readFile(new URL(name, assetDirectory), 'utf8');
  for (const marker of ['DEV_CONTRACT_PREVIEW_ONLY', 'auction_demo', 'epoch_demo', 'request_demo', 'demo-round', 'demo-hidden', 'demo-missing', 'round-unit']) {
    assert.ok(!contents.includes(marker), `Development contract fixture leaked into production asset ${name}: ${marker}`);
  }
}
console.log('Production assets contain no development preview marker or selected synthetic fixture identifiers.');
