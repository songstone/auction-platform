import { expect, test } from '@playwright/test';
import type { Page, Response } from '@playwright/test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const phase = process.env.E2E_PHASE ?? 'up';
const reservedId = ' QA/한글 +%?#= ';
const big = '1234567890123456789012345678901234567890';
const expectedIds = ['demo-round', ...Array.from({ length: 47 }, (_, i) => `discovery-${String(i).padStart(3, '0')}`),
  reservedId, ' discovery-tie ', 'DISCOVERY-TIE', 'discovery-Tie', '한글-동률'];
const isList = (response: Response) => new URL(response.url()).pathname === '/api/v1/rounds';
const links = (page: Page) => page.locator('.round-list .round-link');
async function ids(page: Page) { return links(page).evaluateAll((items) => items.map((item) => item.textContent)); }
async function firstPage(page: Page) {
  const response = page.waitForResponse(isList);
  await page.goto('/');
  const received = await response;
  expect(received.status()).toBe(200);
  expect(received.headers()['cache-control']).toBe('no-store');
  await expect(page.getByRole('heading', { name: '공개 회차 목록', exact: true })).toBeVisible();
  return await received.json();
}
async function allPages(page: Page) {
  const first = await firstPage(page);
  let cursor = first.nextCursor, pages = 1;
  const observed = [...first.items.map((item: { roundId: string }) => item.roundId)];
  while (cursor !== null) {
    expect(pages).toBeLessThan(expectedIds.length + 1);
    const response = page.waitForResponse(isList);
    await page.getByRole('button', { name: '더 보기', exact: true }).click();
    const received = await response;
    expect(new URL(received.url()).searchParams.get('cursor')).toBe(cursor);
    expect(received.status()).toBe(200);
    const body = await received.json();
    observed.push(...body.items.map((item: { roundId: string }) => item.roundId));
    cursor = body.nextCursor; pages++;
    await expect(links(page)).toHaveCount(observed.length);
  }
  expect(pages).toBeGreaterThan(1);
  expect(observed).toEqual(expectedIds);
  expect(await ids(page)).toEqual(expectedIds);
  await expect(page.getByRole('button', { name: '더 보기', exact: true })).toHaveCount(0);
  return pages;
}

if (phase === 'empty') {
  for (const width of [1280, 390]) test(`REAL_EMPTY_${width}: migrated empty DB is distinct from an error`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    expect(await firstPage(page)).toEqual({ items: [], nextCursor: null });
    await expect(page.getByRole('heading', { name: '공개된 회차가 없습니다.' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(links(page)).toHaveCount(0);
    await page.screenshot({ path: info.outputPath(`empty-${width}.png`), fullPage: true });
  });
}

if (phase === 'discovery') {
  for (const width of [1280, 390]) test(`REAL_DISCOVERY_${width}: all pages, exact reserved ID, detail and history`, async ({ page, context, browser }, info) => {
    await page.setViewportSize({ width, height: 844 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const pages = await allPages(page);
    expect(await context.cookies()).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('body')).not.toContainText(/discovery-hidden|demo-hidden|sellerEmail|reservePrice|jdbc:|SQLException/);
    const card = page.locator('.round-card').filter({ has: page.locator(`a[href="/?roundId=${encodeURIComponent(reservedId)}"]`) });
    await expect(card).toContainText(big);
    await expect(card.locator('time')).toHaveAttribute('datetime', '2100-01-03T01:00:00.123456Z');
    await expect(card.locator('time')).toHaveText('2100.01.03 10:00:00.123456');
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`list-all-${width}.png`), fullPage: true });
    const response = page.waitForResponse((item) => new URL(item.url()).pathname === '/api/v1/rounds/' + encodeURIComponent(reservedId));
    await card.getByRole('link').click();
    const detail = await response;
    expect(detail.status()).toBe(200);
    expect((await detail.json()).roundId).toBe(reservedId);
    expect(new URL(page.url()).searchParams.get('roundId')).toBe(reservedId);
    await expect(page.getByTestId('round-version')).toHaveText(big);
    expect(await page.locator('.round-id').textContent()).toBe(reservedId);
    await page.screenshot({ path: info.outputPath(`reserved-detail-${width}.png`), fullPage: true });
    await page.reload();
    await expect(page.getByTestId('round-version')).toHaveText(big);
    await page.goBack();
    await expect(links(page).first()).toHaveText('demo-round');
    await page.goForward();
    await expect(page.getByTestId('round-version')).toHaveText(big);
    await page.getByRole('link', { name: '← 공개 회차 목록', exact: true }).click();
    await expect(links(page).first()).toHaveText('demo-round');
    expect(errors).toEqual([]);
    await info.attach('observations', { body: JSON.stringify({ evidenceClass: 'BROWSER_INTEGRATION', width, pages,
      items: expectedIds.length, browser: browser.version(), anonymousCookies: 0, consoleErrors: errors }), contentType: 'application/json' });
  });
}

function syntheticRound(roundId: string) {
  return { roundId, roundVersion: big, status: 'PUBLISHED', recruitmentOpensAt: '2099-12-01T00:00:00Z',
    publicationAt: '2099-12-31T15:00:00Z', scheduledStartsAt: '2100-01-02T01:00:00.123456Z',
    actualStartedAt: null, completedAt: null, cancelledAt: null, laneCount: 4,
    durations: { preparationSeconds: 5, initialBidSeconds: 10, followupBidSeconds: 5 }, durationsFrozen: false };
}
const wire = (body: unknown, status = 200) => ({ status, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });

if (phase === 'fault') {
  const malformed = {
    'unknown-root': { items: [], nextCursor: null, sellerEmail: 'qa-private-marker' },
    'unknown-item': { items: [{ ...syntheticRound('x'), sellerEmail: 'qa-private-marker' }], nextCursor: null },
    'unknown-nested': { items: [{ ...syntheticRound('x'), durations: { preparationSeconds: 5, initialBidSeconds: 10, followupBidSeconds: 5, secret: 'qa-private-marker' } }], nextCursor: null },
    'numeric-counter': { items: [{ ...syntheticRound('x'), roundVersion: 9007199254740992 }], nextCursor: null },
    'invalid-date': { items: [{ ...syntheticRound('x'), scheduledStartsAt: '2100-02-30T00:00:00Z' }], nextCursor: null },
  };
  for (const [name, body] of Object.entries(malformed)) test(`MOCK_REJECTION_${name}: consumer rejects malformed response`, async ({ page }, info) => {
    await page.route('**/api/v1/rounds', (route) => route.fulfill(wire(body)));
    await page.goto('/');
    await expect(page.getByRole('alert')).toContainText('목록을 불러오지 못했습니다.');
    await expect(links(page)).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('qa-private-marker');
    await info.attach('evidence-class', { body: 'SYNTHETIC_HTTP_FAULT_NOT_REAL_DATABASE', contentType: 'text/plain' });
  });

  test('MOCK_RETRY: failed next-page retry uses identical cursor and appends once', async ({ page }) => {
    const cursors: (string | null)[] = [];
    let nextCalls = 0;
    await page.route('**/api/v1/rounds*', async (route) => {
      const cursor = new URL(route.request().url()).searchParams.get('cursor'); cursors.push(cursor);
      if (cursor === null) return route.fulfill(wire({ items: [syntheticRound('first')], nextCursor: ' opaque/한글 +% ' }));
      if (++nextCalls === 1) return route.fulfill(wire({ code: 'SERVICE_UNAVAILABLE', message: 'qa-private-marker',
        traceId: 'synthetic-trace', serverTime: '2100-01-01T00:00:00Z', fieldErrors: [] }, 503));
      return route.fulfill(wire({ items: [syntheticRound('first'), syntheticRound('second')], nextCursor: null }));
    });
    await page.goto('/');
    await page.getByRole('button', { name: '더 보기', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('앞서 불러온 회차는 유지됩니다.');
    expect(await ids(page)).toEqual(['first']);
    await page.getByRole('button', { name: '다시 시도', exact: true }).click();
    await expect(links(page)).toHaveCount(2);
    expect(await ids(page)).toEqual(['first', 'second']);
    expect(cursors).toEqual([null, ' opaque/한글 +% ', ' opaque/한글 +% ']);
    await expect(page.locator('body')).not.toContainText('qa-private-marker');
  });

  test('MOCK_CANCELLATION: delayed append is cancelled and refresh stays visible', async ({ page }, info) => {
    let firstCalls = 0, nextCalls = 0, release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    await page.route('**/api/v1/rounds*', async (route) => {
      if (new URL(route.request().url()).searchParams.has('cursor')) {
        nextCalls++; await held;
        await route.fulfill(wire({ items: [syntheticRound('stale')], nextCursor: null })).catch(() => {});
      } else {
        firstCalls++;
        await route.fulfill(wire({ items: [syntheticRound(firstCalls === 1 ? 'old' : 'current')], nextCursor: firstCalls === 1 ? 'next' : null }));
      }
    });
    await page.goto('/');
    await page.getByRole('button', { name: '더 보기', exact: true }).click();
    await expect.poll(() => nextCalls).toBe(1);
    await expect(page.getByRole('button', { name: '불러오는 중…', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: '목록 새로고침', exact: true }).click();
    await expect(links(page)).toHaveText(['current']);
    release();
    await page.waitForLoadState('networkidle');
    expect(await ids(page)).toEqual(['current']);
    expect(nextCalls).toBe(1);
    await info.attach('evidence-scope', { body: 'SYNTHETIC_HTTP_FAULT: browser cancellation and retained refresh only. Abort-ignoring late delivery is covered separately by FE deferred unit tests.', contentType: 'text/plain' });
  });
}

if (phase === 'recovery') {
  for (const width of [1280, 390]) test(`REAL_RECOVERY_${width}: same document and Page retry after database loss`, async ({ page, context }, info) => {
    test.setTimeout(120_000);
    const directory = process.env.E2E_HANDSHAKE_DIR;
    if (!directory) throw new Error('Recovery requires the disposable runner handshake directory.');
    const signal = (name: string) => join(directory, `${width}-${name}.json`);
    const waitSignal = async (name: string) => expect.poll(() => existsSync(signal(name)), { timeout: 60_000 }).toBe(true);
    await page.setViewportSize({ width, height: 844 });
    let navigations = 0;
    page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) navigations++; });
    await firstPage(page);
    await expect(links(page).first()).toHaveText('demo-round');
    const marker = `same-document-${width}`;
    await page.evaluate((value) => { (window as Window & { qaDocumentIdentity?: string }).qaDocumentIdentity = value; }, marker);
    const originalUrl = page.url();
    await page.screenshot({ path: info.outputPath('before-loss.png'), fullPage: true });
    writeFileSync(signal('stop-request'), JSON.stringify({ width, state: 'healthy-page-open' }));
    await waitSignal('stopped');
    for (const name of ['목록 새로고침', '다시 시도']) {
      const response = page.waitForResponse(isList);
      await page.getByRole('button', { name, exact: true }).click();
      const received = await response;
      expect(received.status()).toBe(503);
      expect(received.headers()['cache-control']).toBe('no-store');
      expect((await received.json()).code).toBe('SERVICE_UNAVAILABLE');
      await expect(page.getByRole('alert')).toContainText('잠시 목록을 조회할 수 없습니다.');
      await expect(page.getByRole('heading', { name: '공개된 회차가 없습니다.' })).toHaveCount(0);
      await expect(page.locator('body')).not.toContainText(/jdbc:|SQLException|password|org\.postgresql|discovery-hidden|sellerEmail/);
    }
    await expect(links(page)).toHaveCount(0);
    await page.screenshot({ path: info.outputPath('database-down.png'), fullPage: true });
    writeFileSync(signal('restore-request'), JSON.stringify({ width, state: 'same-page-error' }));
    await waitSignal('restored');
    const response = page.waitForResponse(isList);
    await page.getByRole('button', { name: '다시 시도', exact: true }).click();
    expect((await response).status()).toBe(200);
    await expect(links(page).first()).toHaveText('demo-round');
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(page.url()).toBe(originalUrl);
    expect(navigations).toBe(1);
    expect(context.pages()).toEqual([page]);
    expect(await page.evaluate(() => (window as Window & { qaDocumentIdentity?: string }).qaDocumentIdentity)).toBe(marker);
    await expect(page.locator('body')).not.toContainText(/jdbc:|SQLException|password|org\.postgresql/);
    await page.screenshot({ path: info.outputPath('same-page-recovered.png'), fullPage: true });
    await info.attach('same-page-proof', { body: JSON.stringify({ width, navigations, documentMarkerRetained: true,
      pageCount: context.pages().length, originalUrl, finalUrl: page.url(), runner: JSON.parse(readFileSync(signal('restored'), 'utf8')) }), contentType: 'application/json' });
  });
}
