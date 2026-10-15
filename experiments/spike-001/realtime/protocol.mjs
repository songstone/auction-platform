import http from 'node:http';
import { performance } from 'node:perf_hooks';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import { LaneStore } from '../src/main/resources/static/lane-store.js';

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function runEnvironment(base) {
  const files = ['protocol.mjs', 'load.mjs', 'browser-run.mjs', 'reconnect.mjs', 'corruption.mjs', 'audit-validator.mjs', 'package-lock.json', '../src/main/resources/static/client.js', '../src/main/resources/static/lane-store.js', '../src/main/resources/static/index.html'];
  const sourceHashes = Object.fromEntries(await Promise.all(files.map(async file => [file, createHash('sha256').update(await fs.readFile(new URL(file, import.meta.url))).digest('hex')])));
  const health = await api(base, '/health').catch(error => ({ unavailable: error.message }));
  const peer = await api('http://127.0.0.1:18082', '/health').catch(error => ({ unavailable: error.message }));
  return { node: process.version, platform: process.platform, arch: process.arch, osRelease: os.release(), cpuModel: os.cpus()[0]?.model, logicalProcessors: os.cpus().length, totalMemoryBytes: os.totalmem(), sourceHashes, health, peer, peerRole: 'Second JVM judgment worker manual/idle; SSE outbox poll may still run', generatorLocation: 'Same Windows host as applications and experimental DB' };
}
export function assertLoopback(base) {
  const url = new URL(base);
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Experiment requires HTTP loopback');
}
export async function api(base, path, body) {
  assertLoopback(base);
  const response = await fetch(new URL(path, base), { method: body === undefined ? 'GET' : 'POST', headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.code || data.message || `HTTP ${response.status}`), { status: response.status, data });
  return data;
}
export function checkPublic(value) {
  const banned = /^(reserve|reservePrice|reserveAmount|seller|sellerId|sellerActor|winner|winnerId|winnerActor|highestActor|email|password|token|session)$/i;
  for (const [key, entry] of Object.entries(value || {})) {
    if (banned.test(key)) throw new Error(`Private field in public payload: ${key}`);
    if (entry && typeof entry === 'object') checkPublic(entry);
  }
}
export class ProtocolClient {
  constructor(base, key) {
    assertLoopback(base); this.base = base; this.key = key; this.metrics = { snapshots: 0, events: 0, publicErrors: [], errors: [], readyToSnapshotMs: [] };
    this.store = new LaneStore({ onGap: reason => { this.sync(reason).catch(() => {}); } }); this.closed = true; this.resync = false; this.generation = 0; this.connected = false;
  }
  async connect() {
    this.closed = false; this.store.beginSync(); const generation = ++this.generation;
    const current = () => generation === this.generation && !this.closed;
    await new Promise((resolve, reject) => {
      let input = '', frame = { event: 'message', data: [], id: '' }, ready = false;
      const timeout = setTimeout(() => reject(new Error('SSE ready timeout')), 15000);
      this.request = http.get(new URL(`/events?client=${encodeURIComponent(this.key)}`, this.base), response => {
        if (response.statusCode !== 200) { clearTimeout(timeout); reject(new Error(`SSE HTTP ${response.statusCode}`)); response.resume(); return; }
        response.setEncoding('utf8');
        response.on('data', chunk => {
          if (!current()) return;
          this.lastActivityMono = performance.now();
          input += chunk;
          while (input.includes('\n')) {
            const end = input.indexOf('\n'); const line = input.slice(0, end).replace(/\r$/, ''); input = input.slice(end + 1);
            if (!line) {
              const event = frame; frame = { event: 'message', data: [], id: '' };
              if (event.event === 'ready') {
                if (!ready) { ready = true; this.connected = true; clearTimeout(timeout); this.readyAt = performance.now(); this.sync('ready').then(resolve, reject); }
              } else if (event.data.length) {
                try {
                  const data = JSON.parse(event.data.join('\n')); checkPublic(data);
                  if (event.event === 'state') { this.metrics.events++; this.store.receive(data); }
                  if (event.event === 'heartbeat') this.store.checkVersions(data.versions);
                } catch (error) { this.metrics.publicErrors.push(error.message); }
              }
              continue;
            }
            if (line.startsWith(':')) continue;
            const split = line.indexOf(':'); const field = split < 0 ? line : line.slice(0, split); const value = split < 0 ? '' : line.slice(split + 1).replace(/^ /, '');
            if (field === 'data') frame.data.push(value); else if (field === 'event' || field === 'id') frame[field] = value;
          }
        });
        response.on('end', () => { if (current()) { this.connected = false; this.store.beginSync(); this.metrics.errors.push('unexpected-stream-end'); } });
        response.on('error', error => { if (current()) { this.connected = false; this.metrics.errors.push(error.message); } });
      });
      this.request.on('error', error => { clearTimeout(timeout); if (!ready) reject(error); else if (current()) { this.connected = false; this.metrics.errors.push(error.message); } });
    });
  }
  async sync(reason = 'manual') {
    if (this.closed) return;
    if (this.syncing) { this.resync = true; return this.syncing; }
    const generation = this.generation;
    this.syncing = (async () => {
      do {
        this.resync = false; this.store.beginSync();
        const snapshot = await api(this.base, '/snapshot'); if (generation !== this.generation || this.closed) return;
        checkPublic(snapshot); this.store.mergeSnapshot(snapshot); this.metrics.snapshots++;
      } while (this.resync || this.store.buffering);
      if (reason === 'ready') this.metrics.readyToSnapshotMs.push(performance.now() - this.readyAt);
    })().catch(error => { if (generation === this.generation && !this.closed) { this.metrics.errors.push(error.message); throw error; } }).finally(() => { if (generation === this.generation) this.syncing = undefined; });
    return this.syncing;
  }
  disconnect() { this.closed = true; this.connected = false; this.generation++; this.request?.destroy(); this.syncing = undefined; this.resync = false; this.store.beginSync(); }
  state() { return this.store.snapshot(); }
}
export async function submit(base, { actor, key, lane, auction, amount }, { beforeResult } = {}) {
  const clicked = performance.now();
  await api(base, '/intents', { actor, key, auction, amount });
  let result = await api(base, '/bids', { actor, key, lane, auction, amount });
  const deadline = performance.now() + 10000;
  while (result.outcome === 'PENDING') {
    if (performance.now() > deadline) return { actor, key, lane, auction, outcome: 'TIMEOUT', elapsedMs: performance.now() - clicked, boundary: 'PROTOCOL_INTENT_TO_FINAL_RESPONSE' };
    await sleep(10); result = await api(base, `/requests?actor=${encodeURIComponent(actor)}&key=${encodeURIComponent(key)}`);
  }
  if (!['ACCEPTED', 'REJECTED'].includes(result.outcome)) throw new Error('Invalid final request outcome');
  if (beforeResult) await beforeResult(result);
  const elapsedMs = performance.now() - clicked;
  await api(base, '/ack', { actor, key });
  return { actor, key, lane, auction, amount, outcome: result.outcome, code: result.code, seq: result.seq, receivedMs: result.receivedMs, decidedMs: result.decidedMs, elapsedMs, boundary: 'PROTOCOL_INTENT_TO_FINAL_RESPONSE' };
}
export function distribution(values) {
  const sorted = [...values].sort((a, b) => a - b), pick = p => sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] ?? null;
  return { n: sorted.length, p50: pick(.5), p95: pick(.95), p99: pick(.99), max: sorted.at(-1) ?? null };
}
export function options(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) { if (!args[i].startsWith('--')) throw new Error(`Invalid option ${args[i]}`); result[args[i].slice(2)] = args[i + 1]?.startsWith('--') || !args[i + 1] ? true : args[++i]; }
  return result;
}
