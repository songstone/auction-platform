/** Independent policy replay for the bid-only load fixture; not a general command validator. */
export function validateAudit(audit, observed = []) {
  const errors = [], byRequest = new Map(), auctionById = new Map(audit.auctions.map(row => [row.auction, row]));
  const add = (code, detail) => errors.push({ code, ...detail });
  const key = row => `${row.actor}\u0000${row.key ?? row.request_key}`;
  let priorSeq = 0, priorReceipt = -Infinity;
  for (const request of audit.requests) {
    if (Number(request.seq) <= priorSeq) add('REQUEST_SEQUENCE_NOT_INCREASING', { key: request.key, seq: request.seq });
    if (Number(request.receivedMs) < priorReceipt) add('RECEIPT_TIME_REGRESSION', { key: request.key });
    priorSeq = Number(request.seq); priorReceipt = Number(request.receivedMs);
    if (byRequest.has(key(request))) add('DUPLICATE_ORIGINAL_REQUEST', { key: request.key });
    byRequest.set(key(request), request);
    if (request.outcome === 'PENDING') add('UNDECIDED_AFTER_LOAD_DRAIN', { key: request.key });
    if (request.result && ['outcome', 'code', 'seq', 'receivedMs', 'decidedMs'].some(field => request.result[field] !== request[field])) add('ORIGINAL_RESULT_NOT_PRESERVED', { key: request.key });
  }
  for (const auction of audit.auctions) {
    const requests = audit.requests.filter(row => row.kind === 'BID' && row.auction === auction.auction);
    const bids = audit.bids.filter(row => row.auction === auction.auction);
    let high = null, leader = null, deadline = auction.open_ms == null ? null : Number(auction.open_ms) + Number(audit.lane.initial_ms);
    for (const request of requests) {
      const received = Number(request.receivedMs), expectedAmount = high == null ? Number(auction.start_price) : high + Number(auction.increment);
      const eligible = deadline != null && received >= Number(auction.open_ms) && received < deadline && request.actor !== auction.seller && request.actor !== leader && Number(request.amount) === expectedAmount;
      const expected = eligible ? 'ACCEPTED' : 'REJECTED';
      if (request.outcome !== expected) add('POLICY_DECISION_MISMATCH', { key: request.key, auction: auction.auction, seq: request.seq, receivedMs: received, deadline, expected, actual: request.outcome, actualCode: request.code });
      if (eligible) { high = Number(request.amount); leader = request.actor; deadline = received + Number(audit.lane.follow_ms); }
      const matching = bids.filter(bid => key(bid) === key(request));
      if (matching.length !== (request.outcome === 'ACCEPTED' ? 1 : 0)) add('LOGICAL_BID_EFFECT_COUNT', { key: request.key, actualEffects: matching.length, outcome: request.outcome });
      if (matching.length && ['auction', 'actor', 'seq', 'amount'].some(field => matching[0][field] !== request[field])) add('BID_DIFFERS_FROM_ORIGINAL_REQUEST', { key: request.key });
      if (matching.length && Number(matching[0].received_ms) !== received) add('BID_RECEIPT_CHANGED', { key: request.key });
      if (request.outcome === 'ACCEPTED' && request.result?.snapshot?.auction === auction.auction) {
        if (Number(request.result.snapshot.highestAmount) !== Number(request.amount) || Number(request.result.snapshot.deadlineMs) !== received + Number(audit.lane.follow_ms)) add('ACCEPTED_ORIGINAL_SNAPSHOT_INCONSISTENT', { key: request.key });
      }
    }
    if (auction.highest_amount !== high || auction.highest_bidder !== leader) add('HIGHEST_NOT_POLICY_REPLAY', { auction: auction.auction, expectedHigh: high, actualHigh: auction.highest_amount });
    if (auction.open_ms != null && auction.deadline_ms !== deadline) add('DEADLINE_NOT_RECEIPT_PLUS_WINDOW', { auction: auction.auction, expected: deadline, actual: auction.deadline_ms });
    if (auction.result != null) {
      const expected = high != null && high >= Number(auction.reserve) ? 'SOLD' : 'UNSOLD';
      if (auction.result !== expected) add('FINAL_RESULT_INCONSISTENT', { auction: auction.auction, expected, actual: auction.result });
      if (Number(auction.result_ms) !== deadline) add('FINAL_BOUNDARY_INCONSISTENT', { auction: auction.auction });
    }
  }
  for (const bid of audit.bids) if (!byRequest.has(key(bid))) add('BID_WITHOUT_ORIGINAL_REQUEST', { key: bid.request_key });
  for (const response of observed.filter(row => ['ACCEPTED', 'REJECTED'].includes(row.outcome))) {
    const saved = byRequest.get(key(response));
    if (!saved || ['outcome', 'code', 'seq', 'receivedMs', 'decidedMs'].some(field => saved[field] !== response[field])) add('RESPONSE_DIFFERS_FROM_DURABLE_ORIGINAL', { key: response.key });
  }
  const versions = audit.outbox.map(row => Number(row.version));
  if (versions.some((version, index) => version !== index + 1)) add('COMMITTED_OUTBOX_VERSION_GAP', { versions });
  if (versions.at(-1) !== Number(audit.lane.version)) add('STATE_OUTBOX_VERSION_MISMATCH', { stateVersion: audit.lane.version, eventVersion: versions.at(-1) });
  return { scope: 'INDEPENDENT_BID_ONLY_FIXTURE_POLICY_REPLAY', lane: audit.lane.lane, requests: audit.requests.length, bids: audit.bids.length, originalResponsesChecked: observed.length, errors, pass: errors.length === 0 };
}
