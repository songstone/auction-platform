import test from 'node:test';
import assert from 'node:assert/strict';
import { examples } from '../src/generated/contract-examples.ts';
import { applyPreviewEvent, compareCounters, createPreviewState } from '../src/dev/preview-model.ts';

// Mutated payloads below are test-only counterexamples, never new contract fixtures.
test('counter strings remain exact above the JSON safe-integer range', () => {
  assert.equal(compareCounters('9007199254740993', '9007199254740992'), 1);
  assert.equal(compareCounters('8', '8'), 0);
  assert.throws(() => compareCounters('08', '8'));
});

test('snapshot duplicate events do not overwrite state, including reordered JSON keys', () => {
  const state = createPreviewState();
  const reordered = structuredClone(examples.LaneChanged);
  reordered.data = Object.fromEntries(Object.entries(reordered.data).reverse());
  const duplicate = applyPreviewEvent(state, reordered);
  assert.equal(duplicate.needsResync, false);
  assert.equal(duplicate.lanes, state.lanes);
  assert.equal(applyPreviewEvent(state, examples.RoundChanged).round, state.round);
});

test('same scope and version with conflicting contents requires snapshot confirmation', () => {
  const state = createPreviewState();
  const conflict = structuredClone(examples.LaneChanged);
  conflict.data.controlState.held = true;
  const result = applyPreviewEvent(state, conflict);
  assert.equal(result.needsResync, true);
  assert.equal(result.lanes, state.lanes);
});

test('a version gap does not apply a guessed state or advance any cursor', () => {
  const state = createPreviewState();
  const gap = structuredClone(examples.NoSaleLaneChanged);
  gap.data.laneVersion = '10';
  const result = applyPreviewEvent(state, gap);
  assert.equal(result.needsResync, true);
  assert.equal(result.lanes, state.lanes);
  assert.equal(result.baseline.cursor, state.baseline.cursor);
});

test('epoch and round mismatches do not apply an event', () => {
  for (const change of [{ streamEpoch: 'different_epoch' }, { roundId: 'different_round' }, { schemaVersion: 2 }]) {
    const state = createPreviewState();
    const result = applyPreviewEvent(state, { ...examples.NoSaleLaneChanged, ...change });
    assert.equal(result.needsResync, true);
    assert.equal(result.lanes, state.lanes);
  }
});

test('the next lane version applies only to its own lane and terminal NO_SALE retains no live price', () => {
  const state = createPreviewState();
  const result = applyPreviewEvent(state, examples.NoSaleLaneChanged);
  assert.equal(result.needsResync, false);
  assert.equal(result.lanes[0].laneVersion, '9');
  assert.equal(result.lanes[0].currentAuction, null);
  assert.equal(result.lanes[0].lastResult.status, 'NO_SALE');
  assert.ok(!JSON.stringify(result.lanes[0]).includes('highestBidAmount'));
  assert.equal(result.lanes[1], state.lanes[1]);
  assert.equal(result.round, state.round);
  // Original snapshot bytes are a fixture baseline, not the newly applied state/cursor.
  assert.equal(result.baseline.lanes[0].currentAuction.highestBidAmount, '10000');
  assert.equal(result.baseline.cursor, state.baseline.cursor);
});

test('heartbeat changes no business state or cursor, and version mismatch requests resync', () => {
  const state = createPreviewState();
  const result = applyPreviewEvent(state, examples.Heartbeat);
  assert.equal(result.round, state.round);
  assert.equal(result.lanes, state.lanes);
  assert.equal(result.baseline.cursor, state.baseline.cursor);
  const mismatch = { ...examples.Heartbeat, roundVersion: '4' };
  assert.equal(applyPreviewEvent(state, mismatch).needsResync, true);
});

test('resync-required preserves business controls and prevents stale callbacks applying more events', () => {
  const state = createPreviewState();
  state.lanes[0] = { ...state.lanes[0], controlState: { held: true, manualStopped: true } };
  const resync = applyPreviewEvent(state, examples.ResyncRequired);
  assert.equal(resync.needsResync, true);
  const stale = applyPreviewEvent(resync, examples.NoSaleLaneChanged);
  assert.equal(stale.lanes, state.lanes);
  assert.deepEqual(stale.lanes[0].controlState, { held: true, manualStopped: true });
});

test('private fixture stages preserve original request and outcome identity without conflating another rejection', () => {
  assert.equal(examples.RegisteredIntent.registrationState, 'REGISTERED');
  assert.ok(!Object.hasOwn(examples.RegisteredIntent, 'receivedAt'));
  assert.equal(examples.PendingBid.requestId, examples.ApprovedBid.requestId);
  assert.equal(examples.PendingBid.amount, examples.ApprovedBid.amount);
  assert.equal(examples.AcknowledgedBid.requestId, examples.ApprovedBid.requestId);
  assert.equal(examples.AcknowledgedBid.outcomeId, examples.ApprovedBid.outcomeId);
  assert.notEqual(examples.RejectedBid.requestId, examples.ApprovedBid.requestId);
  assert.equal(typeof examples.PendingBid.receiptSequence, 'string');
});
