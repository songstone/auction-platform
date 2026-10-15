import assert from 'node:assert/strict';
import { validateAudit } from './audit-validator.mjs';

const first = { actor: 'fixture-a', key: 'first', kind: 'BID', lane: 1, auction: 'fixture-item', amount: 10000, seq: 1, receivedMs: 1000, outcome: 'ACCEPTED', code: 'BID_ACCEPTED', decidedMs: 1002 };
const second = { actor: 'fixture-b', key: 'second', kind: 'BID', lane: 1, auction: 'fixture-item', amount: 10000, seq: 2, receivedMs: 1001, outcome: 'REJECTED', code: 'PRICE_MISMATCH', decidedMs: 1003 };
for (const request of [first, second]) request.result = { outcome: request.outcome, code: request.code, seq: request.seq, receivedMs: request.receivedMs, decidedMs: request.decidedMs, snapshot: { auction: 'fixture-item', highestAmount: 10000, deadlineMs: 6000 } };
const fixture = {
  lane: { lane: 1, initial_ms: 10000, follow_ms: 5000, version: 2 },
  auctions: [{ auction: 'fixture-item', start_price: 10000, increment: 1000, reserve: 10000, seller: 'fixture-seller', open_ms: 0, deadline_ms: 6000, highest_amount: 10000, highest_bidder: 'fixture-a', result: null }],
  requests: [first, second],
  bids: [{ auction: 'fixture-item', actor: 'fixture-a', request_key: 'first', lane: 1, seq: 1, amount: 10000, received_ms: 1000 }],
  outbox: [{ version: 1 }, { version: 2 }]
};
assert.equal(validateAudit(fixture, [first, second]).pass, true);
const scenarios = [
  ['wrong approval', audit => { audit.requests[1].outcome = 'ACCEPTED'; }, 'POLICY_DECISION_MISMATCH'],
  ['missing committed bid effect', audit => { audit.bids = []; }, 'LOGICAL_BID_EFFECT_COUNT'],
  ['highest price regression', audit => { audit.auctions[0].highest_amount = null; }, 'HIGHEST_NOT_POLICY_REPLAY'],
  ['incorrect first-bid deadline max', audit => { audit.auctions[0].deadline_ms = 10000; }, 'DEADLINE_NOT_RECEIPT_PLUS_WINDOW'],
  ['changed original decision', audit => { audit.requests[0].result.receivedMs = 999; }, 'ORIGINAL_RESULT_NOT_PRESERVED'],
  ['wrong final result', audit => { audit.auctions[0].result = 'UNSOLD'; audit.auctions[0].result_ms = 6000; }, 'FINAL_RESULT_INCONSISTENT'],
  ['outbox lost committed version', audit => { audit.outbox = [{ version: 2 }]; }, 'COMMITTED_OUTBOX_VERSION_GAP']
];
for (const [name, mutate, code] of scenarios) {
  const audit = structuredClone(fixture); mutate(audit);
  assert.ok(validateAudit(audit).errors.some(error => error.code === code), name);
}
console.log(JSON.stringify({ scope: 'AUDIT_VALIDATOR_SYNTHETIC_ORACLE_ONLY', validFixture: 'PASS', detectedCorruptions: scenarios.map(([name]) => name), passed: scenarios.length + 1 }, null, 2));
