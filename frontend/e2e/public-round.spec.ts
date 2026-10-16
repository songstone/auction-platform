import { expect, test } from '@playwright/test';

const phase = process.env.E2E_PHASE ?? 'up';

if (phase === 'up') {
  test('public round renders the real API values and Seoul schedule', async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const response = page.waitForResponse((item) => item.url().endsWith('/api/v1/rounds/demo-round'));
    await page.goto('/?roundId=demo-round');
    const received = await response;
    expect(received.status()).toBe(200);
    expect(received.headers()['cache-control']).toBe('no-store');
    const body = await received.json();
    expect(body.roundVersion).toBe('9007199254740993');
    expect(body.laneCount).toBe(4);
    await expect(page.getByRole('heading', { name: '공개 회차', exact: true })).toBeVisible();
    await expect(page.getByText('공개 · 시작 전', { exact: true })).toBeVisible();
    await expect(page.getByTestId('lane-count')).toHaveText('4개 레인');
    await expect(page.getByTestId('round-version')).toHaveText('9007199254740993');
    await expect(page.getByText('2099.10.15 00:00:00', { exact: true })).toBeVisible();
    await expect(page.getByText('2099.10.16 10:00:00', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('아직 시작하지 않음', { exact: true })).toBeVisible();
    await expect(page.getByText('10초', { exact: true })).toBeVisible();
    await expect(page.getByText('5초', { exact: true })).toHaveCount(2);
    expect(errors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('public-round-desktop.png'), fullPage: true });
  });

  for (const roundId of ['demo-hidden', 'demo-missing']) {
    test(`${roundId} returns indistinguishable public 404 and supports a real retry`, async ({ page }) => {
      const endpoint = `/api/v1/rounds/${roundId}`;
      const first = page.waitForResponse((response) => response.url().endsWith(endpoint));
      await page.goto(`/?roundId=${roundId}`);
      const response = await first;
      expect(response.status()).toBe(404);
      expect((await response.json()).code).toBe('RESOURCE_NOT_FOUND');
      await expect(page.getByRole('alert')).toContainText('회차를 찾을 수 없습니다.');
      await expect(page.getByRole('alert')).toContainText('회차가 없거나 아직 공개되지 않았습니다.');
      await expect(page.getByTestId('lane-count')).toHaveCount(0);
      const retry = page.waitForResponse((item) => item.url().endsWith(endpoint));
      await page.getByRole('button', { name: '다시 시도', exact: true }).click();
      expect((await retry).status()).toBe(404);
      await expect(page.getByRole('alert')).toContainText('회차를 찾을 수 없습니다.');
      await expect(page.locator('body')).not.toContainText(/SQLException|jdbc:|stacktrace|password|org\.postgresql/i);
    });
  }

  test('entry without a round link makes no API request', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => { if (new URL(request.url()).pathname.startsWith('/api/')) requests.push(request.url()); });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '회차 링크로 접속해 주세요.' })).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(requests).toEqual([]);
  });

  test('mobile viewport shows public state and permits refresh without horizontal overflow', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?roundId=demo-round');
    await expect(page.getByTestId('lane-count')).toHaveText('4개 레인');
    await expect(page.getByRole('heading', { name: '회차 일정', exact: true })).toBeVisible();
    const refresh = page.waitForResponse((response) => response.url().endsWith('/api/v1/rounds/demo-round'));
    await page.getByRole('button', { name: '새로고침', exact: true }).click();
    expect((await refresh).status()).toBe(200);
    await expect(page.getByTestId('round-version')).toHaveText('9007199254740993');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('public-round-mobile.png'), fullPage: true });
  });

  test('production bundle does not expose the development contract preview', async ({ page }) => {
    await page.goto('/?preview=contract');
    await expect(page.getByRole('heading', { name: '회차 링크로 접속해 주세요.' })).toBeVisible();
    await expect(page.locator('[data-preview]')).toHaveCount(0);
    await expect(page.getByRole('link', { name: '개발용 계약 예제 열기' })).toHaveCount(0);
  });
}

if (phase === 'changed') {
  test('a changed database row reaches the API and DOM after a fresh read', async ({ page }) => {
    const response = page.waitForResponse((item) => item.url().endsWith('/api/v1/rounds/demo-round'));
    await page.goto('/?roundId=demo-round');
    const received = await response;
    expect(received.status()).toBe(200);
    const body = await received.json();
    expect(body.laneCount).toBe(4);
    expect(body.durations.initialBidSeconds).toBe(15);
    expect(body.roundVersion).toBe('9007199254740994');
    await expect(page.getByTestId('lane-count')).toHaveText('4개 레인');
    await expect(page.getByText('15초', { exact: true })).toBeVisible();
    await expect(page.getByTestId('round-version')).toHaveText('9007199254740994');
  });
}

if (phase === 'down' || phase === 'database-down') {
  test('actual database loss produces a safe 503 view and a real failed retry', async ({ page }, testInfo) => {
    const response = page.waitForResponse((item) => item.url().endsWith('/api/v1/rounds/demo-round'));
    await page.goto('/?roundId=demo-round');
    const received = await response;
    expect(received.status()).toBe(503);
    expect((await received.json()).code).toBe('SERVICE_UNAVAILABLE');
    await expect(page.getByRole('alert')).toContainText('잠시 조회할 수 없습니다.');
    await expect(page.getByTestId('lane-count')).toHaveCount(0);
    const retry = page.waitForResponse((item) => item.url().endsWith('/api/v1/rounds/demo-round'));
    await page.getByRole('button', { name: '다시 시도', exact: true }).click();
    expect((await retry).status()).toBe(503);
    await expect(page.getByRole('alert')).toContainText('잠시 조회할 수 없습니다.');
    await expect(page.locator('body')).not.toContainText(/SQLException|jdbc:|stacktrace|password|org\.postgresql/i);
    await page.screenshot({ path: testInfo.outputPath('database-unavailable.png'), fullPage: true });
  });
}
