import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { api, sleep, distribution, options, checkPublic, ProtocolClient, runEnvironment } from './protocol.mjs';

const opts = options(process.argv.slice(2)), base = opts.base || 'http://127.0.0.1:18081';
if (!opts['core-passed']) throw new Error('Browser integration waits for E1/E2 correctness pass');
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-browser`;
const output = path.resolve(opts.output || '../results/realtime', runId); await fs.mkdir(output, { recursive: true });
const screenshots = path.resolve('output/playwright', runId); await fs.mkdir(screenshots, { recursive: true });
if (!opts['no-reset']) {
  await api(base, '/admin/dispatcher', { paused: true });
  await api(base, '/admin/reset', { lanes: 4, itemsPerLane: 1000, prepMs: 5000, initialMs: 10000, followMs: 5000, startPrice: 10000, increment: 1000, reserve: 10000, manual: false });
}
await api(base, '/admin/dispatcher', { paused: false });
const browser = await chromium.launch({ channel: opts.channel || 'chrome', headless: !opts.headed });
const environment = await runEnvironment(base);
const contexts = [], pages = [], errors = [], clockSamples = [], reconnectRuns = [], expectedFailures = [];
const serverConnectionSamples = [], clickLaunches = [], frozenChecks = [], freezeSettlements = []; let expectedCommits = [], measurementBaseline, measurementEnd;
const background = Array.from({ length: 95 }, (_, i) => new ProtocolClient(base, `background-${runId}-${i}`));
let hundredConnectionMetrics, workerFrozen = false;
const coreFields = ['lane', 'auction', 'ordinal', 'stage', 'version', 'highestAmount', 'hasBid', 'reserveMet', 'openMs', 'windowStartMs', 'deadlineMs', 'manualStopped', 'held', 'holdReason', 'stopId', 'recoveryConfirmed', 'historyComplete', 'result', 'lastResult', 'nextAmount'];
const coreState = lanes => lanes.map(lane => Object.fromEntries(coreFields.map(field => [field, lane[field] ?? null]))).sort((a, b) => a.lane - b.lane);
async function freezeSnapshot(phase) {
  const mode = await api(base, '/admin/mode', { manual: true }); workerFrozen = true;
  assert.equal(mode.manual, true, 'Worker must be frozen for exact state verification');
  const started = performance.now(), deadline = started + 15000;
  const settle = { phase, startedWallMs: Date.now(), requiredStableMs: 1000, maximumSettleMs: 15000, pollDelayMs: 100, coreFields, observations: [], settled: false,
    scope: 'FIXTURE_SETUP_BEFORE_RECONNECT_LATENCY: observed core-state stability, not a production pause barrier or proof all in-flight work has finished' };
  freezeSettlements.push(settle);
  let prior, stableSince;
  try {
    while (performance.now() < deadline) {
      let timer;
      let target;
      try {
        target = await Promise.race([
          api(base, '/snapshot'),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${phase}: fixture settling exceeded15s`)), Math.max(1, deadline - performance.now())); })
        ]);
      } finally { clearTimeout(timer); }
      const observed = performance.now(), state = JSON.stringify(coreState(target.lanes));
      if (state !== prior) { prior = state; stableSince = observed; }
      const stableMs = observed - stableSince;
      settle.observations.push({ elapsedMs: observed - started, stableMs, serverMs: target.serverMs ?? target.lanes[0]?.serverMs, versions: target.lanes.map(lane => [lane.lane, lane.version]) });
      if (observed <= deadline && stableMs >= 1000) {
        settle.settled = true; settle.stableMs = stableMs; settle.settledWallMs = Date.now();
        return target;
      }
      await sleep(Math.min(100, Math.max(0, deadline - performance.now())));
    }
    throw new Error(`${phase}: core state did not remain unchanged for1s within15s`);
  } finally { settle.elapsedMs = performance.now() - started; }
}
async function unfreezeWorkers() {
  await api(base, '/admin/mode', { manual: false }); workerFrozen = false;
}
async function verifyFrozenPages(target, phase) {
  await Promise.all(pages.map(page => page.waitForFunction(target => !window.spike.store.buffering && target.every(lane => Number(document.querySelector(`#lane-${lane.lane}`)?.dataset.version) === lane.version), target.lanes, { timeout: 15000 })));
  const observations = await Promise.all(pages.map(page => page.evaluate(lanes => {
    const labels = { PREPARING: '입찰 준비', INITIAL: '첫 입찰 대기', FOLLOWUP: '후속 입찰 진행', SOLD: '낙찰 확정', UNSOLD: '유찰 확정', CANCELLED: '취소 확정', ENDED: '레인 완료' };
    const dom = lanes.map(lane => {
      const card = document.querySelector(`#lane-${lane.lane}`);
      const expected = { auction: String(lane.auction), version: String(lane.version), item: `상품 ${lane.ordinal ?? lane.auction}`, price: lane.hasBid ? `${new Intl.NumberFormat().format(Number(lane.highestAmount))}원` : '아직 입찰 없음', status: lane.held ? `결과 보류 (${lane.holdReason || '복구 확인 필요'})` : lane.manualStopped ? '진행 중단' : labels[lane.result || lane.stage] || lane.stage, deadline: lane.deadlineMs ? `현재 마감 ${new Date(lane.deadlineMs).toLocaleTimeString('ko-KR', { hour12: false })}` : '현재 마감 없음', nextBid: `${new Intl.NumberFormat().format(Number(lane.nextAmount))}원 입찰` };
      const actual = { auction: card?.dataset.auction, version: card?.dataset.version, item: card?.querySelector('.item')?.textContent, price: card?.querySelector('.price')?.textContent, status: card?.querySelector('.status')?.textContent, deadline: card?.querySelector('.deadline')?.textContent, nextBid: card?.querySelector('.bid')?.textContent };
      return { lane: lane.lane, expected, actual, mismatches: Object.keys(expected).filter(field => actual[field] !== expected[field]) };
    });
    return { state: window.spike.state, dom, cardCount: document.querySelectorAll('#lanes .card').length };
  }, target.lanes)));
  const check = { phase, target: target.lanes, observations, stateFields: coreFields, scope: 'FROZEN_AUTHORITATIVE_CORE_STATE_AND_ACTUAL_DOM_TEXT', passed: false };
  frozenChecks.push(check);
  for (const [page, observed] of observations.entries()) {
    assert.deepEqual(coreState(observed.state), coreState(target.lanes), `${phase}: page ${page} model must equal authoritative state exactly`);
    assert.equal(observed.cardCount, target.lanes.length, `${phase}: page ${page} lane card count`);
    assert.deepEqual(observed.dom.filter(lane => lane.mismatches.length), [], `${phase}: page ${page} DOM text must match authoritative state`);
  }
  assert.deepEqual(coreState((await api(base, '/snapshot')).lanes), coreState(target.lanes), `${phase}: frozen target changed during verification`);
  check.passed = true;
  return observations;
}
async function sampleClock(phase) {
  for (let i = 0; i < 10; i++) clockSamples.push(await pages[0].evaluate(async phase => {
    const started = Date.now(), clock = await fetch('/clock').then(response => response.json()), ended = Date.now();
    return { phase, clientWallMs: (started + ended) / 2, roundTripMs: ended - started, midpointOffsetMs: Number(clock.serverMs) - (started + ended) / 2, halfRttUncertaintyMs: (ended - started) / 2 };
  }, phase));
}
try {
  for (let i = 0; i < 5; i++) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } }); contexts.push(context);
    const page = await context.newPage(); pages.push(page);
    page.on('pageerror', error => errors.push({ page: i, error: error.message }));
    await page.goto(`${base}/?actor=browser-${randomUUID()}&client=dom-${runId}-${i}`);
    await page.waitForFunction(() => window.spike?.state.length === 4 && !window.spike.store.buffering);
    await page.evaluate(() => {
      window.__spikeHarnessClicks = [];
      document.addEventListener('click', event => {
        const button = event.target.closest('.bid');
        if (button) window.__spikeHarnessClicks.push({ lane: Number(button.dataset.lane), clientWallMs: Date.now(), clientMonoMs: performance.now() });
      }, true);
    });
  }
  await Promise.all(background.map(client => client.connect()));
  hundredConnectionMetrics = await api(base, '/metrics');
  assert.ok(Number(hundredConnectionMetrics.activeConnections) >= 100, 'R-49 browser sample requires 100 actual SSE connections');
  await sampleClock('begin');
  await sleep(5200);
  measurementBaseline = await api(base, '/snapshot');
  const samples = Number(opts.samples || 100), bidStarted = Date.now();
  for (let i = 0; i < samples; i++) {
    await sleep(Math.max(0, bidStarted + i * 500 - Date.now()));
    if (i % 20 === 0) serverConnectionSamples.push({ sample: i, metrics: await api(base, '/metrics'), connectedBackgroundClients: background.filter(client => client.connected).length });
    const page = pages[Math.floor(i / 4) % 2], id = i % 4 + 1;
    await page.waitForFunction(id => !document.querySelector(`#lane-${id} .bid`).disabled, id);
    const before = await page.evaluate(() => window.spike.measurements.bid.length);
    await page.locator(`#lane-${id} .bid`).click();
    const dispatched = await page.evaluate(() => window.__spikeHarnessClicks.at(-1));
    assert.equal(dispatched.lane, id, 'Scheduled bid must produce a real click on the selected lane');
    clickLaunches.push({ sample: i, lane: id, scheduledWallMs: bidStarted + i * 500, ...dispatched, launchDelayMs: dispatched.clientWallMs - (bidStarted + i * 500) });
    await page.waitForFunction(before => window.spike.measurements.bid.length > before || window.spike.measurements.errors.length > 0, before, { timeout: 12000 });
    const failure = await page.evaluate(() => window.spike.measurements.errors); assert.equal(failure.length, 0, JSON.stringify(failure));
  }
  measurementEnd = await api(base, '/snapshot');
  await Promise.all(pages.map(page => page.waitForFunction(target => target.every(lane => Number(document.querySelector(`#lane-${lane.lane}`)?.dataset.version) >= lane.version), measurementEnd.lanes, { timeout: 5000 })));
  for (const lane of measurementBaseline.lanes) {
    const end = measurementEnd.lanes.find(row => row.lane === lane.lane);
    const journal = await api(base, `/admin/events?lane=${lane.lane}&afterVersion=${lane.version}`);
    expectedCommits.push(...journal.filter(event => Number(event.version) <= Number(end.version)).map(event => ({ lane: event.lane, version: event.version, committedMs: event.committedMs, createdMs: event.createdMs })));
  }
  const retryPage = pages[1 - Math.floor((samples - 1) / 4) % 2], beforeRetry = await retryPage.evaluate(() => ({ bids: window.spike.measurements.bid.length, errors: window.spike.measurements.errors.length }));
  await retryPage.route('**/bids', async route => { await route.fetch(); await route.abort('failed'); });
  await retryPage.locator('#lane-1 .bid').click();
  await retryPage.waitForFunction(count => window.spike.measurements.errors.length > count, beforeRetry.errors);
  const lost = await retryPage.evaluate(() => window.spike.measurements.errors.at(-1));
  expectedFailures.push({ ...lost, expected: true, injection: 'HTTP_RESPONSE_ABORT_AFTER_UPSTREAM_BID_REQUEST' });
  await retryPage.unroute('**/bids');
  for (let tries = 0; tries < 20; tries++) {
    if (await retryPage.evaluate(count => window.spike.measurements.bid.length > count, beforeRetry.bids)) break;
    await retryPage.locator('#lane-1 .resolve').click();
    await sleep(100);
  }
  const recovered = await retryPage.evaluate(() => window.spike.measurements.bid.at(-1));
  assert.equal(recovered.key, lost.key, 'Response loss must recover the original request key');
  assert.ok(['ACCEPTED', 'REJECTED'].includes(recovered.outcome));
  const retryActor = await retryPage.locator('#actor').inputValue();
  const persistedOriginal = await api(base, `/requests?actor=${encodeURIComponent(retryActor)}&key=${encodeURIComponent(lost.key)}`);
  assert.equal(persistedOriginal.outcome, recovered.outcome, 'DOM must show original durable result');
  if (!opts['skip-reconnect']) {
    for (const durationMs of [5000, 15000]) {
      const counts = await Promise.all(pages.map(page => page.evaluate(() => window.spike.measurements.reconnect.length)));
      // Browser network emulation alone did not close existing SSE connections in Chrome155.
      // Exercise actual transport closure through the experiment's visible disconnect control.
      await Promise.all(pages.map(page => page.locator('#disconnect').click()));
      await Promise.all(contexts.map(context => context.setOffline(true))); await sleep(durationMs);
      const disconnectedMetrics = await api(base, '/metrics');
      assert.equal(disconnectedMetrics.activeConnections, 95, 'Five actual browser streams must be closed while95 protocol streams remain');
      const target = await freezeSnapshot(`reconnect-${durationMs}ms`);
      const restoredWall = Date.now(); await Promise.all(contexts.map(context => context.setOffline(false)));
      await Promise.all(pages.map(page => page.locator('#disconnect').click()));
      await Promise.all(pages.map((page, index) => page.waitForFunction(({ target, count }) => window.spike.measurements.reconnect.length > count && target.every(lane => Number(document.querySelector(`#lane-${lane.lane}`)?.dataset.version) >= lane.version), { target: target.lanes, count: counts[index] }, { timeout: 15000 })));
      const networkRestoredToAllDomMs = Date.now() - restoredWall;
      await verifyFrozenPages(target, `reconnect-${durationMs}ms`);
      const snapshots = await Promise.all(pages.map(page => page.evaluate(() => ({ state: window.spike.state, reconnect: window.spike.measurements.reconnect.at(-1) }))));
      reconnectRuns.push({ durationMs, clients: 5, disconnectedMetrics, injection: 'EXPLICIT_UI_EVENTSOURCE_CLOSE_PLUS_BROWSER_OFFLINE_THEN_UI_RECONNECT', nativeAutomaticReconnect: 'NOT_RUN', networkRestoredToAllDomMs, readyToDomMs: snapshots.map(row => row.reconnect.elapsedMs), boundary: 'SSE_READY_TO_DOM_SNAPSHOT', target: target.lanes, snapshots, frozenEqualityVerified: true });
      await unfreezeWorkers();
    }
  }
  await pages[0].screenshot({ path: path.join(screenshots, 'four-lanes.png'), fullPage: true });
  await fs.copyFile(path.join(screenshots, 'four-lanes.png'), path.join(output, 'four-lanes.png'));
  await sampleClock('end');
  const target = await freezeSnapshot('final');
  await verifyFrozenPages(target, 'final');
  const measurements = await Promise.all(pages.map(page => page.evaluate(() => ({ measurements: window.spike.measurements, state: window.spike.state, stats: window.spike.store.stats }))));
  const allBid = measurements.flatMap(row => row.measurements.bid), bid = allBid.filter(row => !expectedFailures.some(failure => failure.key === row.key)), render = measurements.flatMap(row => row.measurements.render), viewerRender = measurements.slice(2).flatMap(row => row.measurements.render);
  const bestClock = phase => clockSamples.filter(sample => sample.phase === phase).sort((a, b) => a.roundTripMs - b.roundTripMs)[0];
  const calibration = { begin: bestClock('begin'), end: bestClock('end') };
  const clockDriftMs = calibration.end.midpointOffsetMs - calibration.begin.midpointOffsetMs;
  const offsetAt = wall => {
    const ratio = Math.max(0, Math.min(1, (wall - calibration.begin.clientWallMs) / (calibration.end.clientWallMs - calibration.begin.clientWallMs)));
    return calibration.begin.midpointOffsetMs + ratio * clockDriftMs;
  };
  const coverage = { expectedCommitViewerPairs: expectedCommits.length * 3, observed: [], missing: [], missingCommitTimestamp: [] };
  for (let index = 2; index < 5; index++) for (const event of expectedCommits) {
    const applied = measurements[index].measurements.applied.find(row => row.laneVersions.some(([lane, version]) => lane === event.lane && Number(version) >= Number(event.version)));
    if (!applied) { coverage.missing.push({ viewer: index, ...event }); continue; }
    if (event.committedMs == null) { coverage.missingCommitTimestamp.push({ viewer: index, ...event }); continue; }
    coverage.observed.push({ viewer: index, ...event, observedVersion: applied.laneVersions.find(([lane]) => lane === event.lane)[1], clientDomWallMs: applied.clientDomWallMs, via: applied.kind, lagMs: applied.clientDomWallMs + offsetAt(applied.clientDomWallMs) - Number(event.committedMs) });
  }
  const commitToDom = coverage.observed.map(row => row.lagMs);
  const clockUncertaintyMs = Math.max(calibration.begin.halfRttUncertaintyMs, calibration.end.halfRttUncertaintyMs) + 1;
  const result = { runId, command: process.argv, scope: '100_SSE_CONNECTIONS_WITH_5_ACTUAL_BROWSER_DOM_SAMPLES', browser: await browser.version(), browserChannel: opts.channel || 'chrome', connections: 100, actualBrowserConnections: 5, protocolBackgroundConnections: 95, roles: { browserBidders: 2, browserViewers: 3, protocolBidRolesIdle: 18, protocolViewers: 77 }, hundredConnectionMetrics, clockSamples, calibration, clockDriftMs, clockUncertaintyMs, commitTimestampResolutionMs: 1, samples: bid.length, scheduledAttemptsPerSecond: 2, bidClickToDomMs: distribution(bid.map(row => row.clickToDomMs)), sseReceiveToDomMs: distribution(render.map(row => row.receiveToDomMs)), publicSnapshotTimestampToDomProxyMs: distribution(viewerRender.map(row => row.serverTimestampToDomProxyMs).filter(Number.isFinite)), dbCommitToDomCalibratedMs: distribution(commitToDom), dbCommitToDomP95UpperBoundMs: commitToDom.length ? distribution(commitToDom).p95 + clockUncertaintyMs + Math.abs(clockDriftMs) : null, exactDbCommitToOtherDom: commitToDom.length ? 'PG_COMMIT_TIMESTAMP_TO_OTHER_VIEWER_DOM_CALIBRATED: viewer pages2..4 only; linear begin/end clock offset with RTT uncertainty plus1ms resolution; absolute observed offset drift added to p95 upper bound' : 'NOT_MEASURED: committedMs unavailable', responseLossRecovery: { expectedFailures, recovered, persistedOriginal, pass: recovered.key === lost.key && persistedOriginal.outcome === recovered.outcome }, reconnectRuns, browserReconnectReadyToDomMs: distribution(reconnectRuns.flatMap(row => row.readyToDomMs)), errors, measurements, screenshot: path.join(output, 'four-lanes.png'), pass: errors.length === 0 && bid.length === samples && measurements.every(row => row.measurements.errors.filter(error => error.kind === 'bid' && !expectedFailures.some(failure => failure.key === error.key)).length === 0) };
  delete result.dbCommitToDomP95UpperBoundMs;
  result.dbCommitToDomP95EstimateWithClockAllowanceMs = commitToDom.length ? distribution(commitToDom).p95 + clockUncertaintyMs + Math.abs(clockDriftMs) : null;
  result.clockAssumption = 'Linear begin/end offset interpolation; RTT midpoint and observed drift are estimates/allowances, not rigorous delay bounds';
  result.domBoundary = 'DOM mutation plus requestAnimationFrame callback; actual pixel paint is not measured';
  result.clickSchedule = { mode: 'SERIAL_BROWSER_DRIVER_WITH_NOMINAL_500MS_SCHEDULE_NOT_OPEN_LOOP', nominalAttemptsPerSecond: 2, clicks: clickLaunches, launchDelayMs: distribution(clickLaunches.map(row => row.launchDelayMs)), lateBeyondOneNominalSlot: clickLaunches.filter(row => row.launchDelayMs >= 500).length, firstToLastClickMs: clickLaunches.length > 1 ? clickLaunches.at(-1).clientWallMs - clickLaunches[0].clientWallMs : null, achievedClicksPerSecond: clickLaunches.length > 1 ? (clickLaunches.length - 1) * 1000 / (clickLaunches.at(-1).clientWallMs - clickLaunches[0].clientWallMs) : null, scope: 'Observed real DOM click dispatch cadence; does not establish sustained open-loop offered load' };
  result.frozenStateAndDomChecks = frozenChecks;
  result.fixtureFreezeSettlements = freezeSettlements;
  result.expectedCommitCoverage = coverage; result.measurementBaseline = measurementBaseline; result.measurementEnd = measurementEnd;
  result.serverConnectionSamples = serverConnectionSamples;
  result.longDurationAllBrowserPerformance = 'NOT_RUN: actual DOM sample under100 mixed connections, not5minx3 all-browser test';
  result.thresholds = { clickToFinalDom: { targetMs: 1000, p95Ms: result.bidClickToDomMs.p95, met: result.bidClickToDomMs.n === samples && result.bidClickToDomMs.p95 <= 1000 }, commitToOtherViewerDom: { targetMs: 1000, p95EstimateMs: result.dbCommitToDomCalibratedMs.p95, estimateWithClockAllowanceMs: result.dbCommitToDomP95EstimateWithClockAllowanceMs, expectedPairs: coverage.expectedCommitViewerPairs, observedPairs: coverage.observed.length, missingPairs: coverage.missing.length + coverage.missingCommitTimestamp.length, met: expectedCommits.length > 0 && coverage.missing.length === 0 && coverage.missingCommitTimestamp.length === 0 && result.dbCommitToDomP95EstimateWithClockAllowanceMs <= 1000 }, reconnectReadyToDom: { targetMs: 3000, p95Ms: result.browserReconnectReadyToDomMs.p95, met: opts['skip-reconnect'] ? null : result.browserReconnectReadyToDomMs.n === 10 && result.browserReconnectReadyToDomMs.p95 <= 3000 } };
  result.pass = result.pass && result.thresholds.clickToFinalDom.met && result.thresholds.commitToOtherViewerDom.met && (result.thresholds.reconnectReadyToDom.met ?? true) && serverConnectionSamples.every(row => row.metrics.activeConnections >= 100 && row.connectedBackgroundClients === 95) && background.every(client => client.metrics.errors.length === 0 && client.metrics.publicErrors.length === 0);
  result.exactDbCommitToOtherDom = 'PG_COMMIT_TIMESTAMP_TO_OTHER_VIEWER_CURRENT_DOM: pages2..4 only; earliest observed version>=commit, including snapshot; clock mapping estimated; missing pairs reported';
  result.environment = environment;
  await fs.writeFile(path.join(output, 'browser-summary.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ runId, samples, clickToDom: result.bidClickToDomMs, sseReceiveToDom: result.sseReceiveToDomMs, exactDbCommitToOtherDom: result.exactDbCommitToOtherDom, pass: result.pass, output }));
  if (!result.pass) process.exitCode = 1;
} catch (error) {
  const failedPages = await Promise.all(pages.map(async (page, index) => ({ index, observation: await page.evaluate(() => ({ connection: document.querySelector('#connection')?.textContent, online: navigator.onLine, state: window.spike?.state, stats: window.spike?.store.stats, measurements: window.spike?.measurements })).catch(e => ({ observationError: e.message })) })));
  await fs.writeFile(path.join(output, 'browser-failure.json'), JSON.stringify({ runId, command: process.argv, environment, fatal: error.message, errors, clockSamples, reconnectRuns, expectedFailures, clickLaunches, frozenChecks, freezeSettlements, failedPages, pass: false }, null, 2)); throw error;
} finally { background.forEach(client => client.disconnect()); await browser.close(); if (workerFrozen) await unfreezeWorkers(); }
