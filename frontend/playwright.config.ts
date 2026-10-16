import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

const baseURL = process.env.E2E_BASE_URL;
if (!baseURL) throw new Error('E2E_BASE_URL must point to the isolated, running frontend and real backend.');
const parsed = new URL(baseURL);
if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('E2E_BASE_URL must be an HTTP(S) URL without credentials.');
const phase = process.env.E2E_PHASE ?? 'up';
if (!['up', 'changed', 'down', 'database-down'].includes(phase)) throw new Error('E2E_PHASE must be up, changed, or down.');
const artifacts = process.env.E2E_ARTIFACT_DIR ?? resolve('../output/playwright/public-round', phase);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 30_000,
  globalTimeout: 180_000,
  outputDir: resolve(artifacts, 'results'),
  reporter: [['list'], ['json', { outputFile: resolve(artifacts, 'report.json') }]],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
