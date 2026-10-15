import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { api, ProtocolClient, submit, sleep, options, runEnvironment } from './protocol.mjs';

const opts = options(process.argv.slice(2)), base = opts.base || 'http://127.0.0.1:18081';
if (!opts['core-passed']) throw new Error('Corruption integration waits for E1/E2 correctness pass');
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-corruption`;
const output = path.resolve(opts.output || '../results/realtime', runId); await fs.mkdir(output, { recursive: true });
const repetitions = Number(opts.repetitions || 10), evidence = { runId, command: process.argv, scope: 'ACTUAL_SSE_PROTOCOL_CORRUPTION_AND_SNAPSHOT_RECOVERY', repetitions, runs: [] };
evidence.environment = await runEnvironment(base);
const selectedCases = opts.only ? String(opts.only).split(',') : null;
const cases = ['duplicate', 'reorder', 'old-previous-product', 'last-event-loss', 'snapshot-race', 'dispatcher-paused', 'slow-client', 'slow-client-overflow'].filter(name => !selectedCases || selectedCases.includes(name));
if (!cases.length || (selectedCases && selectedCases.some(name => !cases.includes(name)))) throw new Error('Unknown --only case');
evidence.selectedCases = cases;
const operators = ['source-a', 'source-b'].map(prefix => `${prefix}-${randomUUID()}`);
async function changedBid(laneId, index) {
  const snapshot = await api(base, '/snapshot'), lane = snapshot.lanes.find(row => row.lane === laneId);
  return submit(base, { actor: operators[index % 2], key: randomUUID(), lane: laneId, auction: lane.auction, amount: lane.nextAmount });
}
async function cancelAndReplace(auction) {
  const actor = `fixture-operator-${randomUUID()}`, key = randomUUID();
  let result = await api(base, '/commands', { actor, key, kind: 'CANCEL', lane: 1, auction, reason: 'E3_OLD_PRODUCT_EVENT_FIXTURE' });
  const until = Date.now() + 5000;
  while (result.outcome === 'PENDING' && Date.now() < until) { await sleep(10); result = await api(base, `/requests?actor=${encodeURIComponent(actor)}&key=${encodeURIComponent(key)}`); }
  assert.equal(result.outcome, 'ACCEPTED'); return result;
}
for (const name of cases) for (let repeat = 1; repeat <= repetitions; repeat++) {
  // Quiesce polling before resetting its cursor and replacing the isolated DB fixture.
  await api(base, '/admin/dispatcher', { paused: true });
  await api(base, '/admin/reset', { lanes: 4, itemsPerLane: 30, prepMs: 0, initialMs: 30000, followMs: 30000, startPrice: 10000, increment: 1000, reserve: 10000, manual: false });
  await api(base, '/admin/dispatcher', { paused: false });
  await sleep(250);
  const key = `${runId}-${name}-${repeat}`, client = new ProtocolClient(base, key), healthy = new ProtocolClient(base, `${key}-healthy`);
  try {
    await Promise.all([client.connect(), healthy.connect()]);
    const statsBefore = { ...client.store.stats }, bids = []; let pausedObservation, productReplacement, overflowRecovery;
    if (name === 'duplicate') {
      await api(base, '/admin/stream-fault', { client: key, duplicateNext: 1 }); bids.push(await changedBid(1, 0));
    } else if (name === 'reorder') {
      await api(base, '/admin/stream-fault', { client: key, reorderNext: true });
      bids.push(await changedBid(1, 0)); await sleep(100); bids.push(await changedBid(1, 1));
    } else if (name === 'old-previous-product') {
      const oldAuction = client.store.lanes.get(1).auction;
      await api(base, '/admin/stream-fault', { client: key, reorderNext: true });
      bids.push(await changedBid(1, 0)); await sleep(100);
      productReplacement = { oldAuction, command: await cancelAndReplace(oldAuction) };
    } else if (name === 'last-event-loss') {
      await api(base, '/admin/stream-fault', { client: key, dropNext: 1 }); bids.push(await changedBid(1, 0));
    } else if (name === 'snapshot-race') {
      client.store.beginSync(); const oldSnapshot = await api(base, '/snapshot');
      bids.push(await changedBid(1, 0)); await sleep(150); client.store.mergeSnapshot(oldSnapshot);
    } else if (name === 'dispatcher-paused') {
      await api(base, '/admin/dispatcher', { paused: true }); const eventsBefore = client.metrics.events;
      bids.push(await changedBid(1, 0)); await sleep(1200);
      pausedObservation = { eventsBefore, eventsAfter: client.metrics.events, state: client.state(), durable: (await api(base, '/snapshot')).lanes };
      await api(base, '/admin/dispatcher', { paused: false });
    } else if (name === 'slow-client') {
      await api(base, '/admin/stream-fault', { client: key, delayMs: 100 });
      for (let i = 0; i < 10; i++) bids.push(await changedBid(i % 4 + 1, Math.floor(i / 4)));
    } else if (name === 'slow-client-overflow') {
      await api(base, '/admin/stream-fault', { client: key, delayMs: 1000 });
      for (let i = 0; i < 90; i++) bids.push(await changedBid(1, i));
      const waitUntil = Date.now() + 5000;
      while (Date.now() < waitUntil && !(await api(base, '/metrics')).overflows) await sleep(50);
      const beforeRecovery = await api(base, '/metrics');
      overflowRecovery = { injectedWriteDelayMs: 1000, burstAcceptedBids: 90, beforeRecovery, expectedStreamErrors: [...client.metrics.errors], healthyErrors: [...healthy.metrics.errors] };
      await api(base, '/admin/stream-fault', { client: key, delayMs: 0 });
      client.disconnect(); client.metrics.errors = []; await client.connect();
    }
    assert.ok(bids.every(row => row.outcome === 'ACCEPTED'), `Fixture failed: ${JSON.stringify(bids)}`);
    const target = await api(base, '/snapshot'), until = Date.now() + 5000;
    // Snapshot convergence can happen before the deliberately delayed duplicate/old frame arrives.
    // Observe both the recovered state and the injected stale frame before ending the case.
    const pendingFaultObservation = () => ['duplicate', 'old-previous-product'].includes(name)
      && client.store.stats.oldOrDuplicate <= statsBefore.oldOrDuplicate;
    while (Date.now() < until && (pendingFaultObservation() || target.lanes.some(lane => Number(client.store.lanes.get(lane.lane)?.version ?? -1) < lane.version))) await sleep(25);
    const state = client.state(), mismatches = target.lanes.filter(lane => {
      const actual = state.find(row => row.lane === lane.lane);
      return !actual || actual.version < lane.version || (actual.version === lane.version && ['auction', 'highestAmount', 'deadlineMs', 'stage', 'result', 'held', 'manualStopped'].some(field => actual[field] !== lane[field]));
    }).map(lane => lane.lane);
    const metrics = await api(base, '/metrics');
    const faultObserved = name === 'duplicate' ? client.store.stats.oldOrDuplicate > statsBefore.oldOrDuplicate : ['reorder', 'last-event-loss'].includes(name) ? client.store.stats.snapshots > statsBefore.snapshots : name === 'old-previous-product' ? client.store.lanes.get(1).auction !== productReplacement.oldAuction && client.store.stats.oldOrDuplicate > statsBefore.oldOrDuplicate : name === 'dispatcher-paused' ? pausedObservation.eventsBefore === pausedObservation.eventsAfter : name === 'slow-client-overflow' ? overflowRecovery.beforeRecovery.overflows > 0 && overflowRecovery.beforeRecovery.maxQueue <= 64 && overflowRecovery.healthyErrors.length === 0 : true;
    const row = { name, repeat, bids, target: target.lanes, state, mismatches, statsBefore, statsAfter: client.store.stats, healthyStats: healthy.store.stats, publicErrors: client.metrics.publicErrors, streamErrors: client.metrics.errors, serverMetrics: metrics, pausedObservation, productReplacement, overflowRecovery, faultObserved, pass: faultObserved && mismatches.length === 0 && client.metrics.publicErrors.length === 0 && client.metrics.errors.length === 0 };
    evidence.runs.push(row);
    await fs.writeFile(path.join(output, 'corruption-summary.json'), JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify({ name, repeat, pass: row.pass, gaps: row.statsAfter.gaps, duplicateIgnored: row.statsAfter.oldOrDuplicate, output }));
  } catch (error) {
    evidence.runs.push({ name, repeat, pass: false, fatal: error.message, state: client.state(), clientMetrics: client.metrics });
    evidence.pass = false; await fs.writeFile(path.join(output, 'corruption-summary.json'), JSON.stringify(evidence, null, 2)); throw error;
  } finally { client.disconnect(); healthy.disconnect(); await api(base, '/admin/dispatcher', { paused: false }).catch(() => {}); }
}
evidence.pass = evidence.runs.every(row => row.pass);
await fs.writeFile(path.join(output, 'corruption-summary.json'), JSON.stringify(evidence, null, 2));
if (!evidence.pass) process.exitCode = 1;
