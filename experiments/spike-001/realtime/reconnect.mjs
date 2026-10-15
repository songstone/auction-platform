import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { api, ProtocolClient, submit, sleep, distribution, options, runEnvironment } from './protocol.mjs';

const opts = options(process.argv.slice(2)), base = opts.base || 'http://127.0.0.1:18081';
if (!opts['core-passed']) throw new Error('Reconnect integration waits for E1/E2 correctness pass');
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-reconnect`;
const output = path.resolve(opts.output || '../results/realtime', runId); await fs.mkdir(output, { recursive: true });
const evidence = { runId, command: process.argv, scope: '20_PROTOCOL_CLIENTS_RECONNECT_NOT_BROWSER_DOM', clients: 20, repetitionsPerDuration: Number(opts.repetitions || 10), durationsMs: [5000, 15000], node: process.version, runs: [] };
const stateFields = ['auction', 'highestAmount', 'hasBid', 'reserveMet', 'openMs', 'windowStartMs', 'deadlineMs', 'stage', 'result', 'lastResult', 'held', 'holdReason', 'manualStopped', 'stopId', 'historyComplete', 'recoveryConfirmed', 'nextAmount'];
const comparable = lanes => lanes.map(lane => Object.fromEntries(['lane', 'version', ...stateFields].map(field => [field, lane[field]])));
async function freezeStable() {
  await api(base, '/admin/mode', { manual: true });
  const started = performance.now(); let stableSince = started, previous;
  while (performance.now() - started < 15000) {
    const snapshot = await api(base, '/snapshot'), current = comparable(snapshot.lanes);
    if (!isDeepStrictEqual(previous, current)) { stableSince = performance.now(); previous = current; }
    if (performance.now() - stableSince >= 1000) return { snapshot, elapsedMs: performance.now() - started, scope: 'FIXTURE_OBSERVED_1S_STABLE_STATE; not production worker quiescence proof' };
    await sleep(100);
  }
  throw new Error('Fixture workers did not settle to one second of stable authority state');
}
evidence.environment = await runEnvironment(base);
let clients = [];
try {
  for (const durationMs of evidence.durationsMs) for (let repeat = 1; repeat <= evidence.repetitionsPerDuration; repeat++) {
    await api(base, '/admin/dispatcher', { paused: true });
    await api(base, '/admin/reset', { lanes: 4, itemsPerLane: 1000, prepMs: 100, initialMs: 1000, followMs: 1000, startPrice: 10000, increment: 1000, reserve: 10000, manual: false });
    await api(base, '/admin/dispatcher', { paused: false });
    clients = Array.from({ length: 20 }, (_, i) => new ProtocolClient(base, `${runId}-${durationMs}-${repeat}-${i}`));
    await Promise.all(clients.map(client => client.connect())); await sleep(200);
    const before = await api(base, '/snapshot'); clients.forEach(client => client.disconnect());
    const bidLane = before.lanes[0];
    const offlineBid = await submit(base, { actor: `offline-${randomUUID()}`, key: randomUUID(), lane: 1, auction: bidLane.auction, amount: bidLane.nextAmount });
    const offlineChanges = [];
    if ([2, 4].includes(repeat % 5)) {
      const actor = `reconnect-operator-${randomUUID()}`, key = randomUUID();
      let command = await api(base, '/commands', { actor, key, kind: 'STOP', lane: 2, reason: 'RECONNECT_OFFLINE_MANUAL_STOP_FIXTURE' });
      const until = performance.now() + 5000;
      while (command.outcome === 'PENDING' && performance.now() < until) {
        await sleep(10); command = await api(base, `/requests?actor=${encodeURIComponent(actor)}&key=${encodeURIComponent(key)}`);
      }
      if (command.outcome !== 'ACCEPTED') throw new Error('Offline STOP fixture did not become accepted');
      offlineChanges.push({ kind: 'STOP', lane: 2, command });
    }
    if ([3, 4].includes(repeat % 5)) offlineChanges.push({ kind: 'KNOWN_HISTORY_FAULT_HOLD', lane: 3, response: await api(base, '/admin/recover', { lanes: [3], reason: 'RECONNECT_OFFLINE_FAULT_FIXTURE', historyComplete: true }) });
    await sleep(durationMs);
    // Freeze after the offline transitions so version advancement cannot hide bad fields.
    // Live subscription/snapshot races are tested separately by corruption.mjs.
    const fixtureSettlement = await freezeStable();
    const target = fixtureSettlement.snapshot, start = performance.now();
    await Promise.all(clients.map(client => client.connect()));
    const states = clients.map(client => client.state());
    const mismatches = states.flatMap((state, index) => target.lanes.filter(lane => {
      const actual = state.find(x => x.lane === lane.lane);
      return !actual || actual.version !== lane.version || stateFields.some(field => !isDeepStrictEqual(actual[field], lane[field]));
    }).map(lane => ({ client: index, lane: lane.lane })));
    const run = { repeat, durationMs, offlineBid, offlineChanges, wallReconnectAllMs: performance.now() - start, readyToSnapshotMs: clients.map(client => client.metrics.readyToSnapshotMs.at(-1)), boundary: 'SSE_READY_TO_AUTHORITATIVE_SNAPSHOT_MODEL_APPLIED', before: before.lanes, target: target.lanes, states, mismatches, errors: clients.flatMap(client => client.metrics.errors), publicErrors: clients.flatMap(client => client.metrics.publicErrors) };
    run.exactStateValidation = 'WORKERS_FROZEN_AFTER_OFFLINE_TRANSITIONS; exact version and17 authority fields; no forced resync after connect';
    run.fixtureSettlement = { elapsedMs: fixtureSettlement.elapsedMs, scope: fixtureSettlement.scope };
    const authorityAfter = await api(base, '/snapshot');
    run.frozenTargetChanges = authorityAfter.lanes.filter(lane => {
      const prior = target.lanes.find(row => row.lane === lane.lane);
      return !prior || prior.version !== lane.version || stateFields.some(field => !isDeepStrictEqual(prior[field], lane[field]));
    }).map(lane => lane.lane);
    evidence.runs.push(run); clients.forEach(client => client.disconnect());
    await fs.writeFile(path.join(output, 'reconnect-summary.json'), JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify({ repeat, durationMs, mismatchCount: mismatches.length, latency: distribution(run.readyToSnapshotMs), output }));
  }
  evidence.distributionMs = distribution(evidence.runs.flatMap(run => run.readyToSnapshotMs));
  evidence.threshold = { targetMs: 3000, p95Ms: evidence.distributionMs.p95, expectedSamples: evidence.clients * evidence.durationsMs.length * evidence.repetitionsPerDuration, met: evidence.distributionMs.n === evidence.clients * evidence.durationsMs.length * evidence.repetitionsPerDuration && evidence.distributionMs.p95 <= 3000, boundary: 'SSE_READY_TO_SNAPSHOT_MODEL_NOT_BROWSER_DOM' };
  evidence.pass = evidence.runs.every(run => run.mismatches.length === 0 && run.publicErrors.length === 0 && run.errors.length === 0 && run.frozenTargetChanges.length === 0) && evidence.threshold.met;
  await fs.writeFile(path.join(output, 'reconnect-summary.json'), JSON.stringify(evidence, null, 2));
  if (!evidence.pass) process.exitCode = 1;
} catch (error) {
  evidence.pass = false; evidence.fatal = error.message;
  await fs.writeFile(path.join(output, 'reconnect-summary.json'), JSON.stringify(evidence, null, 2)); throw error;
} finally { clients.forEach(client => client.disconnect()); }
