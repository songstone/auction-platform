import test from 'node:test';
import assert from 'node:assert/strict';
import { InvalidResponse, formatSeoul, isUtcInstant, parseProblem, parsePublicRound } from '../src/rounds/round-contract.ts';
import { RoundRequestError, createRoundLoader, fetchPublicRound, publicRoundPath } from '../src/rounds/round-client.ts';

function round(overrides = {}) {
  return {
    roundId: 'round-unit', roundVersion: '9007199254740993', status: 'PUBLISHED',
    recruitmentOpensAt: '2099-10-01T00:00:00Z', publicationAt: '2099-10-14T15:00:00Z', scheduledStartsAt: '2099-10-16T01:00:00.123456Z',
    actualStartedAt: null, completedAt: null, cancelledAt: null, laneCount: 4,
    durations: { preparationSeconds: 5, initialBidSeconds: 10, followupBidSeconds: 5 }, durationsFrozen: false,
    ...overrides,
  };
}
function problem(overrides = {}) {
  return { code: 'RESOURCE_NOT_FOUND', message: 'private internal detail must never become UI text', traceId: 'trace-unit', serverTime: '2026-10-16T01:00:00.123456Z', fieldErrors: [], ...overrides };
}
function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('public contract preserves opaque ID, large counter, microseconds and nullable times exactly', () => {
  const value = round({ roundId: ' Round/한글 +% ' });
  assert.equal(parsePublicRound(value, value.roundId), value);
  assert.equal(value.roundVersion, '9007199254740993');
  assert.equal(value.scheduledStartsAt, '2099-10-16T01:00:00.123456Z');
  assert.equal(formatSeoul(value.scheduledStartsAt), '2099.10.16 10:00:00.123456');
  assert.equal(formatSeoul(value.publicationAt), '2099.10.15 00:00:00');
});

test('UTC validation rejects normalized impossible dates and invalid precision or timezone', () => {
  for (const instant of ['2024-02-29T23:59:59.123456Z', '2000-02-29T00:00:00Z', '2099-10-16T01:00:00.1Z']) assert.equal(isUtcInstant(instant), true, instant);
  for (const instant of ['2025-02-29T00:00:00Z', '1900-02-29T00:00:00Z', '2026-04-31T00:00:00Z', '2026-00-01T00:00:00Z', '2026-01-00T00:00:00Z', '2026-01-01T24:00:00Z', '2026-01-01T00:60:00Z', '2026-01-01T00:00:61Z', '2026-01-01T00:00:00.1234567Z', '2026-01-01T09:00:00+09:00', '2026-1-1T00:00:00Z', '0000-01-01T00:00:00Z']) assert.equal(isUtcInstant(instant), false, instant);
});

test('closed public response rejects missing, unexpected, private and malformed fields', () => {
  const missing = round(); delete missing.completedAt;
  for (const value of [null, [], missing, round({ reservePrice: '999' }), round({ roundVersion: 9007199254740992 }), round({ roundVersion: '01' }), round({ status: 'DRAFT' }), round({ laneCount: 0 }), round({ laneCount: 5 }), round({ actualStartedAt: undefined }), round({ completedAt: 'not-time' }), round({ durationsFrozen: 1 }), round({ durations: { preparationSeconds: 5, initialBidSeconds: 10, followupBidSeconds: 5, hidden: true } }), round({ durations: { preparationSeconds: 0.5, initialBidSeconds: 10, followupBidSeconds: 5 } }), round({ durations: { preparationSeconds: Number.MAX_SAFE_INTEGER + 1, initialBidSeconds: 10, followupBidSeconds: 5 } })]) {
    assert.throws(() => parsePublicRound(value, 'round-unit'), InvalidResponse);
  }
  assert.throws(() => parsePublicRound(round(), 'other-round'), InvalidResponse);
  // Do not invent an OPEN-05 duration policy while validating JS integer representation.
  assert.equal(parsePublicRound(round({ durations: { preparationSeconds: -1, initialBidSeconds: 0, followupBidSeconds: Number.MAX_SAFE_INTEGER } }), 'round-unit').durations.preparationSeconds, -1);
});

test('Problem validates its closed shape, codes, calendar and field violation entries', () => {
  assert.equal(parseProblem(problem()).code, 'RESOURCE_NOT_FOUND');
  for (const value of [problem({ code: 'SQL_EXCEPTION' }), problem({ debug: 'secret' }), problem({ traceId: '  ' }), problem({ serverTime: '2026-02-30T00:00:00Z' }), problem({ fieldErrors: [{ field: 'roundId', reason: 'invalid', rejectedValue: 'secret' }] }), problem({ fieldErrors: [{ field: '', reason: 'invalid' }] }), problem({ fieldErrors: null })]) assert.throws(() => parseProblem(value), InvalidResponse);
});

test('request URL encodes the exact ID and fetch uses same-origin no-store', async () => {
  const roundId = ' Round/한글 +% ';
  assert.equal(publicRoundPath(roundId), '/api/v1/rounds/%20Round%2F%ED%95%9C%EA%B8%80%20%2B%25%20');
  assert.throws(() => publicRoundPath('   '), RoundRequestError);
  let observed;
  const result = await fetchPublicRound(roundId, new AbortController().signal, async (path, options) => { observed = { path, options }; return json(round({ roundId })); });
  assert.equal(result.roundId, roundId);
  assert.equal(observed.path, publicRoundPath(roundId));
  assert.equal(observed.options.credentials, 'same-origin');
  assert.equal(observed.options.cache, 'no-store');
  assert.equal(observed.options.headers.Accept, 'application/json');
});

test('HTTP failures become safe categories without exposing raw server or network text', async () => {
  for (const [status, code, kind] of [[404, 'RESOURCE_NOT_FOUND', 'not-found'], [503, 'SERVICE_UNAVAILABLE', 'unavailable'], [400, 'VALIDATION_FAILED', 'invalid-link'], [500, 'INTERNAL_ERROR', 'unexpected']]) {
    await assert.rejects(fetchPublicRound('round-unit', new AbortController().signal, async () => json(problem({ code }), status)), (error) => error.kind === kind && error.message === kind);
  }
  await assert.rejects(fetchPublicRound('round-unit', new AbortController().signal, async () => { throw new Error('credential=secret'); }), (error) => error.kind === 'network' && !error.message.includes('secret'));
});

test('malformed, cached, HTML and mismatched successful responses are rejected', async () => {
  for (const response of [json(round(), 200, { 'Cache-Control': 'public' }), new Response('<html>private debug</html>', { status: 503 }), new Response('{', { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }), json(round({ roundId: 'other-round' })), json(problem({ debug: 'private' }), 500)]) {
    await assert.rejects(fetchPublicRound('round-unit', new AbortController().signal, async () => response), InvalidResponse);
  }
});

test('new request aborts old request and an old successful response cannot overwrite current state', async () => {
  const first = deferred(), second = deferred(), states = [], signals = [];
  const loader = createRoundLoader((state) => states.push(state), (id, signal) => { signals.push(signal); return id === 'old' ? first.promise : second.promise; });
  const old = loader.load('old');
  const current = loader.load('current');
  assert.equal(signals[0].aborted, true);
  second.resolve(round({ roundId: 'current' })); await current;
  first.resolve(round({ roundId: 'old' })); await old;
  assert.deepEqual(states.map((state) => state.kind), ['loading', 'loading', 'ready']);
  assert.equal(states.at(-1).round.roundId, 'current');
});

test('retry clears old data, surfaces safe error, then returns new state; dispose suppresses old errors', async () => {
  const states = []; let count = 0;
  const loader = createRoundLoader((state) => states.push(state), async () => { if (++count === 1) throw new RoundRequestError('unavailable'); return round(); });
  await loader.load('round-unit'); await loader.load('round-unit');
  assert.deepEqual(states.map((state) => state.kind), ['loading', 'error', 'loading', 'ready']);
  assert.equal(states[1].error, 'unavailable');
  const late = deferred(), disposedStates = [];
  const disposed = createRoundLoader((state) => disposedStates.push(state), () => late.promise);
  const pending = disposed.load('round-unit'); disposed.dispose(); late.reject(new Error('late secret')); await pending;
  assert.deepEqual(disposedStates, [{ kind: 'loading' }]);
});
