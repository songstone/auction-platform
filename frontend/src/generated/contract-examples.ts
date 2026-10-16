// GENERATED from contracts/openapi.yaml; do not edit.
// Contract 0.1.0; source SHA-256 4cad0ae25cb48ef7891176594093374ae5007587d28ac5563fc644e21aaa527d
import type { components } from './api.d.ts';

const SnapshotFourLanes = {
  "schemaVersion": 1,
  "streamEpoch": "epoch_demo",
  "roundId": "round_demo",
  "serverTime": "2026-10-20T01:00:06.100000Z",
  "round": {
    "roundId": "round_demo",
    "roundVersion": "3",
    "status": "ACTIVE",
    "recruitmentOpensAt": "2026-10-16T01:00:00Z",
    "publicationAt": "2026-10-18T15:00:00Z",
    "scheduledStartsAt": "2026-10-20T01:00:00.000000Z",
    "actualStartedAt": "2026-10-20T01:00:00.000000Z",
    "completedAt": null,
    "cancelledAt": null,
    "laneCount": 4,
    "durations": {
      "preparationSeconds": 5,
      "initialBidSeconds": 10,
      "followupBidSeconds": 5
    },
    "durationsFrozen": true
  },
  "lanes": [
    {
      "laneId": 1,
      "laneVersion": "8",
      "status": "RUNNING",
      "controlState": {
        "manualStopped": false,
        "held": false
      },
      "currentAuction": {
        "auctionId": "auction_demo",
        "lotId": "lot_demo",
        "stage": "FOLLOWUP_WAIT",
        "startingPrice": "10000",
        "bidIncrement": "1000",
        "highestBidAmount": "10000",
        "reserveMet": false,
        "nextBidAmount": "11000",
        "windowStartAt": "2026-10-20T01:00:05Z",
        "opensAt": "2026-10-20T01:00:05Z",
        "closesAt": "2026-10-20T01:00:11Z"
      },
      "lastResult": null
    },
    {
      "laneId": 2,
      "laneVersion": "1",
      "status": "FINISHED",
      "controlState": {
        "manualStopped": false,
        "held": false
      },
      "currentAuction": null,
      "lastResult": null
    },
    {
      "laneId": 3,
      "laneVersion": "1",
      "status": "FINISHED",
      "controlState": {
        "manualStopped": false,
        "held": false
      },
      "currentAuction": null,
      "lastResult": null
    },
    {
      "laneId": 4,
      "laneVersion": "1",
      "status": "FINISHED",
      "controlState": {
        "manualStopped": false,
        "held": false
      },
      "currentAuction": null,
      "lastResult": null
    }
  ],
  "cursor": "cursor_demo_3_8_1_1_1"
} satisfies components['schemas']['AuctionSnapshot'];

const RoundChanged = {
  "type": "round.state.changed",
  "schemaVersion": 1,
  "eventId": "event_round",
  "streamEpoch": "epoch_demo",
  "roundId": "round_demo",
  "occurredAt": "2026-10-20T01:00:00.000000Z",
  "data": {
    "roundId": "round_demo",
    "roundVersion": "3",
    "status": "ACTIVE",
    "recruitmentOpensAt": "2026-10-16T01:00:00Z",
    "publicationAt": "2026-10-18T15:00:00Z",
    "scheduledStartsAt": "2026-10-20T01:00:00.000000Z",
    "actualStartedAt": "2026-10-20T01:00:00.000000Z",
    "completedAt": null,
    "cancelledAt": null,
    "laneCount": 4,
    "durations": {
      "preparationSeconds": 5,
      "initialBidSeconds": 10,
      "followupBidSeconds": 5
    },
    "durationsFrozen": true
  }
} satisfies components['schemas']['RoundStateEvent'];

const LaneChanged = {
  "type": "lane.state.changed",
  "schemaVersion": 1,
  "eventId": "event_lane",
  "streamEpoch": "epoch_demo",
  "roundId": "round_demo",
  "occurredAt": "2026-10-20T01:00:06.050000Z",
  "data": {
    "laneId": 1,
    "laneVersion": "8",
    "status": "RUNNING",
    "controlState": {
      "manualStopped": false,
      "held": false
    },
    "currentAuction": {
      "auctionId": "auction_demo",
      "lotId": "lot_demo",
      "stage": "FOLLOWUP_WAIT",
      "startingPrice": "10000",
      "bidIncrement": "1000",
      "highestBidAmount": "10000",
      "reserveMet": false,
      "nextBidAmount": "11000",
      "windowStartAt": "2026-10-20T01:00:05Z",
      "opensAt": "2026-10-20T01:00:05Z",
      "closesAt": "2026-10-20T01:00:11Z"
    },
    "lastResult": null
  }
} satisfies components['schemas']['LaneStateEvent'];

const Heartbeat = {
  "type": "stream.heartbeat",
  "schemaVersion": 1,
  "streamEpoch": "epoch_demo",
  "roundId": "round_demo",
  "serverTime": "2026-10-20T01:00:06.100000Z",
  "roundVersion": "3",
  "laneVersions": [
    {
      "laneId": 1,
      "laneVersion": "8"
    },
    {
      "laneId": 2,
      "laneVersion": "1"
    },
    {
      "laneId": 3,
      "laneVersion": "1"
    },
    {
      "laneId": 4,
      "laneVersion": "1"
    }
  ]
} satisfies components['schemas']['HeartbeatEvent'];

const ResyncRequired = {
  "type": "stream.resync-required",
  "schemaVersion": 1,
  "streamEpoch": "epoch_new",
  "roundId": "round_demo",
  "serverTime": "2026-10-20T01:00:00.000000Z",
  "reason": "EPOCH_CHANGED",
  "snapshotUrl": "/api/v1/rounds/round_demo/snapshot"
} satisfies components['schemas']['ResyncRequiredEvent'];

const NoSaleLaneChanged = {
  "type": "lane.state.changed",
  "schemaVersion": 1,
  "eventId": "event_lane_no_sale",
  "streamEpoch": "epoch_demo",
  "roundId": "round_demo",
  "occurredAt": "2026-10-20T01:00:11.050000Z",
  "data": {
    "laneId": 1,
    "laneVersion": "9",
    "status": "FINISHED",
    "controlState": {
      "manualStopped": false,
      "held": false
    },
    "currentAuction": null,
    "lastResult": {
      "auctionId": "auction_demo",
      "lotId": "lot_demo",
      "status": "NO_SALE",
      "finalizedAt": "2026-10-20T01:00:11Z"
    }
  }
} satisfies components['schemas']['LaneStateEvent'];

const RegisteredIntent = {
  "requestId": "request_demo",
  "auctionId": "auction_demo",
  "amount": "10000",
  "registrationState": "REGISTERED",
  "registeredAt": "2026-10-20T01:00:05.900000Z",
  "acknowledgedAt": null
} satisfies components['schemas']['BidIntent'];

const PendingBid = {
  "requestId": "request_demo",
  "auctionId": "auction_demo",
  "amount": "10000",
  "receivedAt": "2026-10-20T01:00:06Z",
  "receiptSequence": "7",
  "status": "PENDING"
} satisfies components['schemas']['BidPending'];

const ApprovedBid = {
  "requestId": "request_demo",
  "auctionId": "auction_demo",
  "amount": "10000",
  "receivedAt": "2026-10-20T01:00:06Z",
  "receiptSequence": "7",
  "status": "APPROVED",
  "outcomeId": "outcome_demo",
  "decidedAt": "2026-10-20T01:00:06.050000Z",
  "resultingClosesAt": "2026-10-20T01:00:11Z"
} satisfies components['schemas']['BidApproved'];

const RejectedBid = {
  "requestId": "request_later",
  "auctionId": "auction_demo",
  "amount": "10000",
  "receivedAt": "2026-10-20T01:00:06Z",
  "receiptSequence": "8",
  "status": "REJECTED",
  "outcomeId": "outcome_rejected",
  "decidedAt": "2026-10-20T01:00:06.060000Z",
  "rejectionCode": "WRONG_AMOUNT"
} satisfies components['schemas']['BidRejected'];

const AcknowledgedBid = {
  "requestId": "request_demo",
  "outcomeId": "outcome_demo",
  "acknowledgedAt": "2026-10-20T01:00:06.200000Z"
} satisfies components['schemas']['BidAcknowledgement'];

export const examples = { SnapshotFourLanes, RoundChanged, LaneChanged, Heartbeat, ResyncRequired, NoSaleLaneChanged, RegisteredIntent, PendingBid, ApprovedBid, RejectedBid, AcknowledgedBid };
export const contractSource = {
  "version": "0.1.0",
  "sha256": "4cad0ae25cb48ef7891176594093374ae5007587d28ac5563fc644e21aaa527d",
  "path": "contracts/openapi.yaml"
} as const;
