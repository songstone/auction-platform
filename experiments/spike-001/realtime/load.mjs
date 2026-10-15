import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { api, ProtocolClient, submit, sleep, distribution, options, runEnvironment } from './protocol.mjs';
import { validateAudit } from './audit-validator.mjs';

const opts = options(process.argv.slice(2)), base = opts.base || 'http://127.0.0.1:18081';
const scenario = opts.scenario || 'base', connections = Number(opts.connections || 100);
const warmupMs = Number(opts['warmup-seconds'] || 60) * 1000, measureMs = Number(opts['measure-seconds'] || 300) * 1000, repetitions = Number(opts.repetitions || 3);
if (!['base', 'concentrated'].includes(scenario)) throw new Error('scenario must be base or concentrated');
if (![100, 200, 400].includes(connections)) throw new Error('approved exploration steps: 100, 200, 400');
if (connections > 100 && !opts['core-and-base-passed']) throw new Error('200/400 require explicit --core-and-base-passed after prior evidence');
if (!opts['core-passed']) throw new Error('Load execution gated: use --core-passed only after E1/E2 correctness pass');
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${scenario}-${connections}`;
const output = path.resolve(opts.output || '../results/realtime', runId); await fs.mkdir(output, { recursive: true });
const evidence = { runId, command: process.argv, scope: 'PROTOCOL_LOAD_ONLY_NOT_BROWSER_DOM', scenario, connections, roles: { bidders: 20, viewers: connections - 20 }, warmupMs, measureMs, repetitions, base, node: process.version, sameHost: true, results: [] };
evidence.environment = await runEnvironment(base);
const allRows = [], actors = Array.from({ length: 20 }, () => `load-${randomUUID()}`);
console.log(JSON.stringify({ runId, phase: 'START', scenario, connections, warmupMs, measureMs, repetitions, output }));
const active = lane => !lane.result && !lane.manualStopped && !lane.held && Number(lane.openMs) <= Number(lane.serverMs) && Number(lane.deadlineMs) > Number(lane.serverMs);
for (let repeat = 1; repeat <= repetitions; repeat++) {
  await api(base, '/admin/dispatcher', { paused: true });
  await api(base, '/admin/reset', { lanes: 4, itemsPerLane: 1000, prepMs: 5000, initialMs: 10000, followMs: 5000, startPrice: 10000, increment: 1000, reserve: 10000, manual: false });
  await api(base, '/admin/dispatcher', { paused: false });
  const clients = Array.from({ length: connections }, (_, i) => new ProtocolClient(base, `${runId}-${repeat}-${i}`));
  await Promise.all(clients.map(client => client.connect()));
  const metricBefore = await api(base, '/metrics').catch(error => ({ unavailable: error.message }));
  const started = performance.now(), pending = new Set(), rows = [], systemErrors = [], batches = [];
  let actorCursor = 0, laneCursor = 0, tick = 0, skipped = 0; const scheduledMisses = [], connectionSamples = [], serverConnectionSamples = [];
  const lastActor = new Map();
  const fire = async (lane, actor, batch) => {
    const scheduledElapsedMs = tick * 500, launchDelayMs = performance.now() - started - scheduledElapsedMs;
    const measurement = scheduledElapsedMs >= warmupMs;
    const key = randomUUID();
    try {
      const row = await submit(base, { actor, key, lane: lane.lane, auction: lane.auction, amount: lane.nextAmount });
      Object.assign(row, { repeat, measurement, batch, scheduledElapsedMs, launchDelayMs }); rows.push(row); allRows.push(row);
      if (row.outcome === 'ACCEPTED') lastActor.set(lane.lane, actor);
    } catch (error) { const row = { repeat, measurement, batch, actor, key, lane: lane.lane, auction: lane.auction, amount: lane.nextAmount, outcome: 'SYSTEM_ERROR', message: error.message, scheduledElapsedMs, launchDelayMs }; rows.push(row); allRows.push(row); systemErrors.push(row); }
  };
  const launch = promise => { pending.add(promise); promise.finally(() => pending.delete(promise)); };
  try {
    while (tick * 500 < warmupMs + measureMs) {
      const until = started + tick * 500; await sleep(Math.max(0, until - performance.now()));
      if (performance.now() - started >= warmupMs + measureMs) break;
      const snapshot = await api(base, '/snapshot');
      connectionSamples.push({ scheduledElapsedMs: tick * 500, observedElapsedMs: performance.now() - started, connected: clients.filter(client => client.connected).length, maximumActivityLagMs: Math.max(...clients.map(client => performance.now() - (client.lastActivityMono ?? started))) });
      if (tick % 30 === 0) serverConnectionSamples.push({ elapsedMs: performance.now() - started, metrics: await api(base, '/metrics') });
      if (scenario === 'base') {
        const lane = snapshot.lanes[laneCursor++ % 4];
        let actor = actors[actorCursor++ % 20]; if (actor === lastActor.get(lane.lane)) actor = actors[actorCursor++ % 20];
        if (lane.auction != null && lane.nextAmount != null) launch(fire(lane, actor, null));
        else { skipped++; scheduledMisses.push({ tick, lane: lane.lane, attempts: 1, stage: lane.stage, reason: 'NO_ITEM_OR_NEXT_AMOUNT' }); }
      } else {
        if (tick % 10 === 0) {
          const lane = snapshot.lanes[0];
          if (lane.auction != null && lane.nextAmount != null) {
            const batch = `${repeat}-${tick}`, begin = performance.now();
            launch(Promise.all(actors.map(actor => fire(lane, actor, batch))).then(() => batches.push({ batch, measurement: begin - started >= warmupMs, lane: lane.lane, auction: lane.auction, amount: lane.nextAmount, snapshotStage: lane.stage, snapshotDeadlineMs: lane.deadlineMs, snapshotServerMs: lane.serverMs, snapshotWasOpen: active(lane), elapsedMs: performance.now() - begin })));
          } else { skipped += 20; scheduledMisses.push({ tick, lane: lane.lane, attempts: 20, stage: lane.stage, reason: 'NO_ITEM_OR_NEXT_AMOUNT' }); }
        }
        if (tick % 2 === 0) {
          const lane = snapshot.lanes[1 + laneCursor++ % 3]; let actor = actors[actorCursor++ % 20];
          if (actor === lastActor.get(lane.lane)) actor = actors[actorCursor++ % 20];
          if (lane.auction != null && lane.nextAmount != null) launch(fire(lane, actor, null));
          else { skipped++; scheduledMisses.push({ tick, lane: lane.lane, attempts: 1, stage: lane.stage, reason: 'NO_ITEM_OR_NEXT_AMOUNT' }); }
        }
      }
      tick++;
      if (tick % 120 === 0) console.log(JSON.stringify({ runId, repeat, scenario, phase: performance.now() - started < warmupMs ? 'WARMUP' : 'MEASURING', elapsedSeconds: Math.round((performance.now() - started) / 1000), attempts: rows.length, pending: pending.size, systemErrors: systemErrors.length, skipped, output }));
    }
    await Promise.allSettled([...pending]);
    // Keep the last half-second slot inside the measured window before freezing workers.
    await sleep(Math.max(0, started + warmupMs + measureMs - performance.now()));
    const workerMode = await api(base, '/health');
    await api(base, '/admin/mode', { manual: true }); await sleep(100);
    const target = await api(base, '/snapshot'); await Promise.all(clients.map(client => client.sync('end-validation')));
    const fields = ['auction', 'highestAmount', 'hasBid', 'reserveMet', 'stage', 'deadlineMs', 'windowStartMs', 'manualStopped', 'held', 'holdReason', 'result', 'lastResult'];
    const mismatches = clients.flatMap(client => target.lanes.filter(lane => {
      const actual = client.store.lanes.get(Number(lane.lane));
      return !actual || actual.version !== lane.version || fields.some(field => JSON.stringify(actual[field]) !== JSON.stringify(lane[field]));
    }).map(lane => ({ client: client.key, lane: lane.lane })));
    const measured = rows.filter(row => row.measurement), complete = measured.filter(row => ['ACCEPTED', 'REJECTED'].includes(row.outcome));
    const batchResults = batches.map(batch => { const bids = rows.filter(row => row.batch === batch.batch); return { ...batch, accepted: bids.filter(row => row.outcome === 'ACCEPTED').length, rejected: bids.filter(row => row.outcome === 'REJECTED').length, systemErrors: bids.filter(row => ['SYSTEM_ERROR', 'TIMEOUT'].includes(row.outcome)).length, codes: Object.fromEntries([...new Set(bids.map(row => row.code))].map(code => [code || 'NONE', bids.filter(row => row.code === code).length])) }; });
    const metricsAfter = await api(base, '/metrics').catch(error => ({ unavailable: error.message }));
    const audits = await Promise.all([1, 2, 3, 4].map(lane => api(base, `/admin/audit?lane=${lane}`)));
    const validation = audits.map(audit => validateAudit(audit, rows.filter(row => row.lane === audit.lane.lane)));
    await fs.writeFile(path.join(output, `audit-${repeat}.json`), JSON.stringify(audits, null, 2));
    const result = { repeat, elapsedMs: performance.now() - started, measuredAttempts: measured.length, completed: complete.length, accepted: complete.filter(row => row.outcome === 'ACCEPTED').length, rejected: complete.filter(row => row.outcome === 'REJECTED').length, failures: measured.filter(row => !['ACCEPTED', 'REJECTED'].includes(row.outcome)).length, skippedScheduleSlots: skipped, latencyMs: distribution(complete.map(row => row.elapsedMs)), latencyBoundary: 'PROTOCOL_INTENT_TO_FINAL_RESPONSE', domLatency: 'NOT_RUN_IN_PROTOCOL_HARNESS', finalStateBehindTarget: mismatches, policyValidation: validation, publicErrors: clients.flatMap(client => client.metrics.publicErrors), streamErrors: clients.flatMap(client => client.metrics.errors), clientStats: clients.map(client => ({ key: client.key, ...client.metrics, merge: client.store.stats })), batchResults, metricBefore, metricsAfter };
    evidence.results.push(result);
    result.workerMode = workerMode;
    result.scheduledMisses = scheduledMisses;
    result.connectionSamples = connectionSamples; result.serverConnectionSamples = serverConnectionSamples;
    result.minimumContinuousClientConnections = Math.min(...connectionSamples.map(sample => sample.connected));
    result.minimumSampledServerConnections = Math.min(...serverConnectionSamples.map(sample => Number(sample.metrics.activeConnections)));
    result.expectedTotalAttempts = (warmupMs + measureMs) / 1000 * (scenario === 'base' ? 2 : 5);
    result.expectedMeasuredAttempts = measureMs / 1000 * (scenario === 'base' ? 2 : 5);
    result.actualTotalAttempts = rows.length;
    result.allPhaseFailures = rows.filter(row => !['ACCEPTED', 'REJECTED'].includes(row.outcome));
    result.launchDelayMs = distribution(rows.map(row => row.launchDelayMs));
    result.lateBeyondOneScheduleSlot = rows.filter(row => row.launchDelayMs >= 500).length;
    result.conditionLimit = '500ms scheduled slot fidelity, not an operational performance target';
    result.postMeasurementWorkerFrozenForExactAudit = true;
    result.protocolResponseReferenceTarget = { targetMs: 1000, p95Ms: result.latencyMs.p95, met: result.latencyMs.p95 <= 1000, boundary: 'PROTOCOL_INTENT_TO_FINAL_RESPONSE_PROXY_NOT_DOM_R49' };
    result.extraMonitoringOverhead = 'One /metrics request every15s plus socket state checks each500ms; root separately samples2HTTP+SQL+dockerstats every15s';
    result.passed = result.allPhaseFailures.length === 0 && result.actualTotalAttempts === result.expectedTotalAttempts && measured.length === result.expectedMeasuredAttempts && skipped === 0 && result.lateBeyondOneScheduleSlot === 0 && result.minimumContinuousClientConnections === connections && result.minimumSampledServerConnections >= connections && mismatches.length === 0 && result.streamErrors.length === 0 && result.publicErrors.length === 0 && Number(metricsAfter.workerErrors) === 0 && serverConnectionSamples.every(row => Number(row.metrics.workerErrors) === 0) && validation.every(row => row.pass);
    await fs.writeFile(path.join(output, 'summary.json'), JSON.stringify(evidence, null, 2));
    await fs.writeFile(path.join(output, 'requests.jsonl'), allRows.map(row => JSON.stringify(row)).join('\n') + '\n');
    console.log(JSON.stringify({ repeat, scenario, ...result.latencyMs, attempts: result.measuredAttempts, failures: result.failures, stateBehind: mismatches.length, skipped: skipped, output }));
  } catch (error) {
    evidence.results.push({ repeat, pass: false, fatal: error.message, partialAttempts: rows.length, partialSystemErrors: systemErrors });
    await fs.writeFile(path.join(output, 'summary.json'), JSON.stringify(evidence, null, 2));
    await fs.writeFile(path.join(output, 'requests.jsonl'), allRows.map(row => JSON.stringify(row)).join('\n') + '\n'); throw error;
  } finally { clients.forEach(client => client.disconnect()); }
}
evidence.finished = new Date().toISOString();
await fs.writeFile(path.join(output, 'summary.json'), JSON.stringify(evidence, null, 2));
if (evidence.results.some(result => !result.passed)) process.exitCode = 1;
