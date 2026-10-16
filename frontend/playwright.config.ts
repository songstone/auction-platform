import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

const baseURL = process.env.E2E_BASE_URL;
if (!baseURL) throw new Error('E2E_BASE_URL must point to the isolated, running frontend and real backend.');
const parsed = new URL(baseURL);
if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('E2E_BASE_URL must be an HTTP(S) URL without credentials.');
const phase = process.env.E2E_PHASE ?? 'up';
if (!['up', 'changed', 'down', 'database-down', 'empty', 'discovery', 'fault', 'recovery'].includes(phase)) throw new Error('Unknown isolated E2E phase.');
const artifacts = process.env.E2E_ARTIFACT_DIR ?? resolve('../output/playwright/public-round', phase);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 30_000,
  globalTimeout: 240_000,
  outputDir: resolve(artifacts, 'results'),
  reporter: [['list'], ['json', { outputFile: resolve(artifacts, 'report.json') }]],
  use: { baseURL, viewport: { width: 1280, height: 844 }, trace: 'on', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 844 } } }],
});
