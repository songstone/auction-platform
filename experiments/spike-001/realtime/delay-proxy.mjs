import http from 'node:http';
import { options, assertLoopback } from './protocol.mjs';

const opts = options(process.argv.slice(2));
const upstreamBase = opts.upstream || 'http://127.0.0.1:18081', port = Number(opts.port || 18091), halfDelayMs = Number(opts['rtt-ms'] || 100) / 2;
assertLoopback(upstreamBase);
if (!Number.isInteger(port) || port < 1024 || halfDelayMs < 0 || halfDelayMs > 1000) throw new Error('Invalid experiment proxy configuration');
const metrics = { requests: 0, streaming: 0, errors: 0, maxDelayedChunks: 0 };
const server = http.createServer((request, response) => {
  if (request.url === '/_proxy') { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ loopback: true, upstream: upstreamBase, configuredAddedRttMs: halfDelayMs * 2, halfDelayMs, metrics, limitation: 'Timer-injected HTTP delay on same host, not an external network simulation' })); return; }
  metrics.requests++;
  const body = [], timers = new Set(); let upstream, ended = false;
  const schedule = callback => { const timer = setTimeout(() => { timers.delete(timer); callback(); }, halfDelayMs); timers.add(timer); metrics.maxDelayedChunks = Math.max(metrics.maxDelayedChunks, timers.size); };
  request.on('data', chunk => body.push(chunk));
  request.on('end', () => schedule(() => {
    if (response.destroyed) return;
    upstream = http.request(new URL(request.url, upstreamBase), { method: request.method, headers: { ...request.headers, host: new URL(upstreamBase).host } }, remote => {
      const streaming = String(remote.headers['content-type']).includes('text/event-stream');
      if (streaming) metrics.streaming++;
      schedule(() => { if (!response.destroyed) { response.writeHead(remote.statusCode, remote.headers); response.flushHeaders(); } });
      remote.on('data', chunk => schedule(() => { if (!response.destroyed) response.write(chunk); }));
      remote.on('end', () => schedule(() => { if (!response.destroyed) response.end(); }));
      remote.on('error', () => { metrics.errors++; response.destroy(); });
    });
    upstream.on('error', error => { metrics.errors++; if (!response.headersSent) response.writeHead(502, { 'Content-Type': 'application/json' }); if (!response.destroyed) response.end(JSON.stringify({ error: 'ExperimentProxyUpstream', message: error.message })); });
    upstream.end(Buffer.concat(body));
  }));
  response.on('close', () => { ended = true; for (const timer of timers) clearTimeout(timer); timers.clear(); upstream?.destroy(); });
});
server.listen(port, '127.0.0.1', () => console.log(JSON.stringify({ ready: true, pid: process.pid, proxy: `http://127.0.0.1:${port}`, upstream: upstreamBase, configuredAddedRttMs: halfDelayMs * 2 })));
process.on('SIGINT', () => { console.log(JSON.stringify({ metrics })); server.close(() => process.exit(0)); });
