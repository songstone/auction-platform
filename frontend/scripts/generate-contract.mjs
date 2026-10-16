import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import openapiTS, { astToString } from 'openapi-typescript';
import { parse } from 'yaml';
import { prepareGeneratorInput } from './generator-input.mjs';

const source = new URL('../../contracts/openapi.yaml', import.meta.url);
const manifestUrl = new URL('../../contracts/approved-baseline-0.1.0.json', import.meta.url);
const sourceText = await readFile(source, 'utf8');
const schema = parse(sourceText);
const sourceSha256 = createHash('sha256').update(sourceText).digest('hex');
const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
if (schema.info.version !== '0.1.0' || schema['x-contract-status'] !== 'USER_APPROVED'
  || manifest.contractVersion !== schema.info.version || manifest.sealingState !== 'SEALED') {
  throw new Error('Expected the sealed, approved contract 0.1.0. Do not edit the contract from frontend/.');
}
const approvedSource = manifest.approvedFiles?.find((file) => file.path === 'contracts/openapi.yaml');
if (approvedSource?.sha256 !== sourceSha256) {
  throw new Error('OpenAPI bytes do not match the sealed approved baseline. Follow the contract change procedure.');
}

const selected = [
  'SnapshotFourLanes', 'RoundChanged', 'LaneChanged', 'Heartbeat', 'ResyncRequired',
  'NoSaleLaneChanged', 'RegisteredIntent', 'PendingBid', 'ApprovedBid', 'RejectedBid', 'AcknowledgedBid',
];
const header = `// GENERATED from contracts/openapi.yaml; do not edit.\n// Contract ${schema.info.version}; source SHA-256 ${sourceSha256}\n`;
const typeOutput = header + '// Tool input derives discriminator mapping from existing required const values only.\n'
  + astToString(await openapiTS(prepareGeneratorInput(schema)));
const fixtureLines = selected.map((name) => {
  const example = schema.components.examples[name];
  const schemaName = example?.['x-schema-ref']?.replace('#/components/schemas/', '');
  if (!example || !schema.components.schemas[schemaName] || !Object.hasOwn(example, 'value')) {
    throw new Error(`Missing approved example/schema reference: ${name}`);
  }
  return `const ${name} = ${JSON.stringify(example.value, null, 2)} satisfies components['schemas']['${schemaName}'];`;
});
const fixtureOutput = `${header}import type { components } from './api.d.ts';\n\n`
  + fixtureLines.join('\n\n')
  + `\n\nexport const examples = { ${selected.join(', ')} };\n`
  + `export const contractSource = ${JSON.stringify({ version: schema.info.version, sha256: sourceSha256, path: 'contracts/openapi.yaml' }, null, 2)} as const;\n`;

const targets = [
  [new URL('../src/generated/api.d.ts', import.meta.url), typeOutput],
  [new URL('../src/generated/contract-examples.ts', import.meta.url), fixtureOutput],
];
if (process.argv.includes('--check')) {
  for (const [url, expected] of targets) {
    const actual = await readFile(url, 'utf8').catch(() => '');
    if (actual !== expected) throw new Error(`${url.pathname} is stale. Run npm run generate:contract and review the diff.`);
  }
  console.log(`Generated types and ${selected.length} examples match approved OpenAPI ${schema.info.version} (${sourceSha256}).`);
} else {
  await mkdir(new URL('../src/generated/', import.meta.url), { recursive: true });
  for (const [url, content] of targets) await writeFile(url, content, 'utf8');
  console.log(`Generated types and ${selected.length} examples from approved OpenAPI ${schema.info.version}.`);
}
