-- Synthetic development/verification data only. Never part of a production migration.
-- Explicitly seed the dedicated local or disposable test database after Flyway has run.
BEGIN;
INSERT INTO auction.rounds (
    round_id, round_version, status, recruitment_opens_at, publication_at,
    scheduled_starts_at, published_at, actual_started_at, completed_at, cancelled_at,
    lane_count, preparation_seconds, initial_bid_seconds, followup_bid_seconds, durations_frozen
) VALUES
    ('demo-round', 9007199254740993, 'PUBLISHED', '2099-10-01T00:00:00Z', '2099-10-14T15:00:00Z',
     '2099-10-16T01:00:00Z', '2099-10-14T15:00:00Z', NULL, NULL, NULL, 4, 5, 10, 5, false),
    ('demo-hidden', 0, 'RECRUITING', '2099-10-01T00:00:00Z', '2099-10-14T15:00:00Z',
     '2099-10-16T01:00:00Z', NULL, NULL, NULL, NULL, 4, 5, 10, 5, false)
ON CONFLICT (round_id) DO NOTHING;
COMMIT;
