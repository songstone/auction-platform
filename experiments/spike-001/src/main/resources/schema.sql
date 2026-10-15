-- Disposable SPIKE-001 schema. Never migrate this directly into a product database.
CREATE TABLE IF NOT EXISTS spike_metadata (
  name text PRIMARY KEY,
  server_epoch timestamptz NOT NULL
);
INSERT INTO spike_metadata(name,server_epoch) VALUES('authority',pg_postmaster_start_time()) ON CONFLICT(name) DO NOTHING;
CREATE TABLE IF NOT EXISTS spike_lane (
  lane integer PRIMARY KEY,
  current_ordinal integer NOT NULL DEFAULT 1,
  item_count integer NOT NULL,
  next_seq bigint NOT NULL DEFAULT 0,
  last_received_ms bigint,
  version bigint NOT NULL DEFAULT 0,
  prep_ms bigint NOT NULL,
  initial_ms bigint NOT NULL,
  follow_ms bigint NOT NULL,
  manual_stopped boolean NOT NULL DEFAULT false,
  held boolean NOT NULL DEFAULT false,
  hold_reason text,
  hold_since_ms bigint,
  hold_cutoff_seq bigint,
  history_complete boolean NOT NULL DEFAULT true,
  recovery_confirmed boolean NOT NULL DEFAULT false,
  stop_id text
);
CREATE TABLE IF NOT EXISTS spike_auction (
  auction text PRIMARY KEY,
  lane integer NOT NULL REFERENCES spike_lane(lane),
  ordinal integer NOT NULL,
  seller text NOT NULL,
  stage text NOT NULL,
  start_price bigint NOT NULL CHECK(start_price > 0),
  increment bigint NOT NULL CHECK(increment > 0),
  reserve bigint NOT NULL CHECK(reserve >= start_price),
  highest_amount bigint,
  highest_bidder text,
  open_ms bigint,
  window_start_ms bigint,
  deadline_ms bigint,
  started boolean NOT NULL DEFAULT false,
  result text,
  result_ms bigint,
  cancel_reason text,
  UNIQUE(lane,ordinal),
  CHECK((highest_amount IS NULL) = (highest_bidder IS NULL))
);
CREATE TABLE IF NOT EXISTS spike_intent (
  actor text NOT NULL,
  request_key text NOT NULL,
  auction text NOT NULL REFERENCES spike_auction(auction),
  amount bigint NOT NULL,
  acknowledged boolean NOT NULL DEFAULT false,
  PRIMARY KEY(actor,request_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS spike_one_pending_intent
  ON spike_intent(actor,auction) WHERE NOT acknowledged;
CREATE TABLE IF NOT EXISTS spike_request (
  actor text NOT NULL,
  request_key text NOT NULL,
  kind text NOT NULL,
  lane integer NOT NULL REFERENCES spike_lane(lane),
  auction text,
  amount bigint,
  reason text,
  stop_id text,
  seq bigint NOT NULL,
  received_ms bigint NOT NULL,
  outcome text NOT NULL DEFAULT 'PENDING',
  code text,
  decided_ms bigint,
  result_json text,
  PRIMARY KEY(actor,request_key),
  UNIQUE(lane,seq)
);
CREATE INDEX IF NOT EXISTS spike_pending_requests ON spike_request(lane,seq) WHERE outcome='PENDING';
CREATE TABLE IF NOT EXISTS spike_bid (
  auction text NOT NULL REFERENCES spike_auction(auction),
  actor text NOT NULL,
  request_key text NOT NULL,
  lane integer NOT NULL,
  seq bigint NOT NULL,
  amount bigint NOT NULL,
  received_ms bigint NOT NULL,
  PRIMARY KEY(actor,request_key),
  UNIQUE(auction,amount)
);
CREATE TABLE IF NOT EXISTS spike_outbox (
  id bigserial PRIMARY KEY,
  lane integer NOT NULL REFERENCES spike_lane(lane),
  version bigint NOT NULL,
  payload_json text NOT NULL,
  created_ms bigint NOT NULL,
  original_xid text NOT NULL DEFAULT pg_current_xact_id()::text,
  published boolean NOT NULL DEFAULT false,
  UNIQUE(lane,version)
);
ALTER TABLE spike_outbox ADD COLUMN IF NOT EXISTS original_xid text NOT NULL DEFAULT pg_current_xact_id()::text;
