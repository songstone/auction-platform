import test from 'node:test';
import assert from 'node:assert/strict';
import { InvalidResponse, parsePublicRoundPage } from '../src/rounds/round-contract.ts';
import { fetchPublicRoundPage, publicRoundHref, publicRoundPagePath, RoundRequestError } from '../src/rounds/round-client.ts';
import { createRoundListLoader } from '../src/rounds/round-list-loader.ts';

function round(roundId, overrides = {}) {
  return {
    roundId, roundVersion: '9007199254740993', status: 'PUBLISHED',
    recruitmentOpensAt: '2099-10-01T00:00:00Z', publicationAt: '2099-10-14T15:00:00Z', scheduledStartsAt: '2099-10-16T01:00:00.123456Z',
    actualStartedAt: null, completedAt: null, cancelledAt: null, laneCount: 4,
    durations: { preparationSeconds: 5, initialBidSeconds: 10, followupBidSeconds: 5 }, durationsFrozen: false,
    ...overrides,
  };
}
function page(ids, nextCursor = null) { return { items: ids.map((id) => round(id)), nextCursor }; }
function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });
}
function problem(code) { return { code, message: 'private database detail', traceId: 'test-trace', serverTime: '2026-10-16T00:00:00Z', fieldErrors: [] }; }
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('closed page preserves server order, exact IDs, counter and microseconds without page-size assumptions', () => {
  const value = page([' Round/한글 +% ', 'z', 'A'], ' Cursor/한글 +%= ');
  assert.equal(parsePublicRoundPage(value), value);
  assert.deepEqual(value.items.map((item) => item.roundId), [' Round/한글 +% ', 'z', 'A']);
  assert.equal(value.items[0].roundVersion, '9007199254740993');
  assert.equal(value.items[0].scheduledStartsAt, '2099-10-16T01:00:00.123456Z');
  assert.deepEqual(parsePublicRoundPage(page([])), { items: [], nextCursor: null });
  assert.equal(parsePublicRoundPage(page([], 'still-more')).nextCursor, 'still-more');
});

test('page rejects unknown or missing root, round and nested duration fields and malformed cursors', () => {
  const missingItem = round('a'); delete missingItem.completedAt;
  const malformed = [null, [], {}, { items: [] }, { nextCursor: null }, { items: {}, nextCursor: null },
    { ...page([]), total: 0 }, { ...page([]), private: 'hidden' }, page([], ''), page([], '  '), page([], 10),
    { items: [null], nextCursor: null }, { items: [missingItem], nextCursor: null },
    { items: [round('a', { sellerEmail: 'private' })], nextCursor: null },
    { items: [round('a', { durations: { preparationSeconds: 5, initialBidSeconds: 10, followupBidSeconds: 5, hidden: true } })], nextCursor: null },
    { items: [round('a', { roundVersion: 9007199254740992 })], nextCursor: null },
    { items: [round('a', { status: 'DRAFT' })], nextCursor: null },
    { items: [round('a', { scheduledStartsAt: '2026-02-30T00:00:00Z' })], nextCursor: null }];
  for (const value of malformed) assert.throws(() => parsePublicRoundPage(value), InvalidResponse);
});

test('first page omits cursor; later page and detail link encode exact opaque values once', async () => {
  const cursor = ' Cursor/한글 +%= ';
  assert.equal(publicRoundPagePath(null), '/api/v1/rounds');
  assert.equal(publicRoundPagePath(cursor), `/api/v1/rounds?cursor=${encodeURIComponent(cursor)}`);
  assert.equal(new URL(publicRoundPagePath(cursor), 'https://example.test').searchParams.get('cursor'), cursor);
  const id = ' Round/한글 +%?#= ';
  assert.equal(new URL(publicRoundHref(id), 'https://example.test').searchParams.get('roundId'), id);
  assert.throws(() => publicRoundPagePath(' '), RoundRequestError);
  assert.throws(() => publicRoundHref(''), RoundRequestError);
  let observed;
  const signal = new AbortController().signal;
  const result = await fetchPublicRoundPage(cursor, signal, async (path, options) => { observed = { path, options }; return json(page([id])); });
  assert.equal(result.items[0].roundId, id);
  assert.equal(observed.path, publicRoundPagePath(cursor));
  assert.equal(observed.options.signal, signal);
  assert.equal(observed.options.cache, 'no-store');
  assert.equal(observed.options.credentials, 'same-origin');
  assert.equal(observed.options.headers.Accept, 'application/json');
});

test('503 and transport failures stay errors, not empty results; raw server details are not surfaced', async () => {
  for (const [code, status, expected] of [['SERVICE_UNAVAILABLE', 503, 'unavailable'], ['VALIDATION_FAILED', 400, 'invalid-link'], ['INTERNAL_ERROR', 500, 'unexpected']]) {
    await assert.rejects(fetchPublicRoundPage(null, new AbortController().signal, async () => json(problem(code), status)), (error) => error.kind === expected && error.message === expected);
  }
  await assert.rejects(fetchPublicRoundPage(null, new AbortController().signal, async () => { throw new Error('secret network info'); }), (error) => error.kind === 'network' && error.message === 'network');
});

test('page fetch rejects cached, HTML, private, non-JSON and malformed error responses', async () => {
  for (const response of [json(page([]), 200, { 'Cache-Control': 'public' }), new Response('<html>secret</html>', { status: 503 }), json({ ...page([]), debug: 'private' }), new Response('{', { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }), json({ ...problem('SERVICE_UNAVAILABLE'), debug: 'private' }, 503)]) {
    await assert.rejects(fetchPublicRoundPage(null, new AbortController().signal, async () => response), InvalidResponse);
  }
});

test('list distinguishes initial loading, empty success and unavailable, then retries first page', async () => {
  const states = [], cursors = []; let count = 0;
  const loader = createRoundListLoader((state) => states.push(state), async (cursor) => {
    cursors.push(cursor);
    if (++count === 1) throw new RoundRequestError('unavailable');
    return page([]);
  });
  await loader.refresh();
  assert.deepEqual(states, [{ kind: 'loading' }, { kind: 'error', error: 'unavailable' }]);
  await loader.refresh();
  assert.deepEqual(cursors, [null, null]);
  assert.deepEqual(states.at(-1), { kind: 'ready', page: page([]), loadingMore: false, error: null });
  await loader.more();
  assert.equal(cursors.length, 2);
});

test('pagination uses server cursor, appends once and ends only at null', async () => {
  const states = [], cursors = [];
  const pages = [page(['b', 'a'], ' cursor +/ '), page(['c'], 'next'), page([])];
  const loader = createRoundListLoader((state) => states.push(state), async (cursor) => { cursors.push(cursor); return pages.shift(); });
  await loader.refresh(); await loader.more(); await loader.more(); await loader.more();
  assert.deepEqual(cursors, [null, ' cursor +/ ', 'next']);
  assert.deepEqual(states.at(-1).page.items.map((item) => item.roundId), ['b', 'a', 'c']);
  assert.equal(states.at(-1).page.nextCursor, null);
  assert.equal(states[2].loadingMore, true);
});

test('concurrent more clicks cause one request and cross-page exact-ID duplicates appear once', async () => {
  const states = [], pending = deferred(); let calls = 0;
  const loader = createRoundListLoader((state) => states.push(state), async () => ++calls === 1 ? page(['a'], 'second') : pending.promise);
  await loader.refresh();
  const first = loader.more(); await loader.more(); await loader.more();
  assert.equal(calls, 2);
  pending.resolve(page(['a', 'A', ' a ', 'b', 'b'])); await first;
  assert.deepEqual(states.at(-1).page.items.map((item) => item.roundId), ['a', 'A', ' a ', 'b']);
});

test('failed next page preserves rows and cursor; retry appends without omission or duplication', async () => {
  const states = [], cursors = []; let calls = 0;
  const loader = createRoundListLoader((state) => states.push(state), async (cursor) => {
    cursors.push(cursor);
    if (++calls === 1) return page(['a'], 'second');
    if (calls === 2) throw new RoundRequestError('unavailable');
    return page(['a', 'b']);
  });
  await loader.refresh(); await loader.more();
  assert.deepEqual(states.at(-1), { kind: 'ready', page: page(['a'], 'second'), loadingMore: false, error: 'unavailable' });
  await loader.more();
  assert.deepEqual(cursors, [null, 'second', 'second']);
  assert.deepEqual(states.at(-1).page.items.map((item) => item.roundId), ['a', 'b']);
  assert.equal(states.at(-1).error, null);
});

test('refresh aborts pending append; late success cannot pollute a new first page', async () => {
  const states = [], old = deferred(), current = deferred(), signals = []; let calls = 0;
  const loader = createRoundListLoader((state) => states.push(state), (cursor, signal) => {
    signals.push(signal);
    if (++calls === 1) return Promise.resolve(page(['old-first'], 'old-second'));
    return calls === 2 ? old.promise : current.promise;
  });
  await loader.refresh(); const append = loader.more(); const refresh = loader.refresh();
  assert.equal(signals[1].aborted, true);
  current.resolve(page(['current'])); await refresh;
  const before = states.length;
  old.resolve(page(['stale'])); await append;
  assert.equal(states.length, before);
  assert.deepEqual(states.at(-1).page.items.map((item) => item.roundId), ['current']);
});

test('overlapping first-page retries cannot replace newer data with a late error', async () => {
  const states = [], old = deferred(), current = deferred(); let calls = 0;
  const loader = createRoundListLoader((state) => states.push(state), () => ++calls === 1 ? old.promise : current.promise);
  const first = loader.refresh(), retry = loader.refresh();
  current.resolve(page(['current'])); await retry;
  old.reject(new RoundRequestError('unavailable')); await first;
  assert.deepEqual(states.map((state) => state.kind), ['loading', 'loading', 'ready']);
  assert.deepEqual(states.at(-1).page.items.map((item) => item.roundId), ['current']);
});

test('leaving the list invalidates pending responses and disposed loader cannot issue requests', async () => {
  for (const outcome of ['success', 'failure']) {
    const states = [], pending = deferred(); let calls = 0, observedSignal;
    const loader = createRoundListLoader((state) => states.push(state), (cursor, signal) => { calls++; observedSignal = signal; return pending.promise; });
    const request = loader.refresh(); loader.dispose();
    assert.equal(observedSignal.aborted, true);
    if (outcome === 'success') pending.resolve(page(['late'])); else pending.reject(new Error('late secret'));
    await request; await loader.refresh(); await loader.more();
    assert.deepEqual(states, [{ kind: 'loading' }]);
    assert.equal(calls, 1);
  }
});
