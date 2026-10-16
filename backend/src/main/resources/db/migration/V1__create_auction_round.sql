-- auction owns this minimal round storage. query has an explicit SELECT-only projection.
-- This migration deliberately contains no development fixture or account credentials.
CREATE SCHEMA auction;

CREATE TABLE auction.rounds (
    round_id text COLLATE "C" PRIMARY KEY CHECK (round_id ~ '[^[:space:]]'),
    round_version numeric NOT NULL CHECK (round_version >= 0 AND round_version < 'Infinity'::numeric
                                         AND round_version = trunc(round_version)),
    status text NOT NULL CHECK (status IN ('SCHEDULED', 'RECRUITING', 'PUBLISHED', 'WAITING', 'ACTIVE', 'COMPLETED', 'CANCELLED')),
    recruitment_opens_at timestamptz NOT NULL,
    publication_at timestamptz NOT NULL,
    scheduled_starts_at timestamptz NOT NULL,
    published_at timestamptz,
    actual_started_at timestamptz,
    completed_at timestamptz,
    cancelled_at timestamptz,
    lane_count integer NOT NULL CHECK (lane_count BETWEEN 1 AND 4),
    preparation_seconds integer NOT NULL,
    initial_bid_seconds integer NOT NULL,
    followup_bid_seconds integer NOT NULL,
    durations_frozen boolean NOT NULL,
    CHECK (recruitment_opens_at < publication_at AND publication_at < scheduled_starts_at)
);

COMMENT ON COLUMN auction.rounds.published_at IS
    'Persisted publication fact; the scheduled publication_at or wall clock alone never grants public visibility.';
COMMENT ON TABLE auction.rounds IS
    'Minimal round state for the first public read flow. This is not the round command/scheduling implementation.';
