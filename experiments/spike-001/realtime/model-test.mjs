import assert from 'node:assert/strict';
import { LaneStore } from '../src/main/resources/static/lane-store.js';

const lane = (laneId, version, auctionId = 'current') => ({ laneId, version, auctionId, highestAmount: version * 100 });
const cases = [];
function test(name, fn) { fn(); cases.push({ name, result: 'PASS' }); }

test('subscribe-before-snapshot buffers concurrent changes and removes duplicates', () => {
  const store = new LaneStore();
  store.receive(lane(1, 2)); store.receive(lane(1, 2));
  store.mergeSnapshot({ lanes: [lane(1, 1)] });
  assert.equal(store.lanes.get(1).version, 2); assert.equal(store.stats.oldOrDuplicate, 1);
});
test('old event cannot restore previous auction or price', () => {
  const store = new LaneStore(); store.mergeSnapshot([lane(1, 5, 'new')]);
  store.receive(lane(1, 4, 'old')); assert.equal(store.lanes.get(1).auctionId, 'new');
});
test('gap and reorder pause application until authoritative resnapshot', () => {
  const gaps = []; const store = new LaneStore({ onGap: cause => gaps.push(cause) });
  store.mergeSnapshot([lane(1, 1)]); store.receive(lane(1, 3)); store.receive(lane(1, 2));
  assert.equal(store.lanes.get(1).version, 1); assert.equal(store.buffering, true);
  store.mergeSnapshot([lane(1, 1)]); assert.equal(store.lanes.get(1).version, 3);
  assert.deepEqual(gaps, ['version-gap']);
});
test('snapshot racing newer applied state cannot regress it', () => {
  const store = new LaneStore(); store.mergeSnapshot([lane(1, 2)]); store.receive(lane(1, 3));
  store.beginSync(); store.mergeSnapshot([lane(1, 2)]); assert.equal(store.lanes.get(1).version, 3);
});
test('silent last event loss detected by authoritative version heartbeat', () => {
  const store = new LaneStore(); store.mergeSnapshot([lane(1, 2)]);
  assert.equal(store.checkVersions({ 1: 3 }), false); assert.equal(store.buffering, true);
  store.mergeSnapshot([lane(1, 3)]); assert.equal(store.lanes.get(1).version, 3);
});
test('bounded buffer overflow forces another snapshot', () => {
  const gaps = []; const store = new LaneStore({ maxBuffer: 2, onGap: cause => gaps.push(cause) });
  store.receive(lane(1, 1)); store.receive(lane(1, 2)); store.receive(lane(1, 3));
  store.mergeSnapshot([lane(1, 3)]); assert.equal(store.buffering, true); assert.ok(gaps.includes('buffer-overflow'));
  store.mergeSnapshot([lane(1, 3)]); assert.equal(store.buffering, false);
});
test('four lane versions advance independently', () => {
  const store = new LaneStore(); store.mergeSnapshot([1, 2, 3, 4].map(id => lane(id, 0)));
  store.receive(lane(4, 1)); store.receive(lane(2, 1));
  assert.deepEqual(store.snapshot().map(x => x.version), [0, 1, 0, 1]);
});
test('resnapshot after reconnect merges events during request', () => {
  const store = new LaneStore(); store.mergeSnapshot([lane(1, 1)]); store.beginSync();
  store.receive(lane(1, 5)); store.mergeSnapshot([lane(1, 4)]); assert.equal(store.lanes.get(1).version, 5);
});
console.log(JSON.stringify({ scope: 'PURE_CLIENT_MODEL_ONLY', cases, passed: cases.length }, null, 2));
