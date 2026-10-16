-- Synthetic M-01 verification data. Explicit disposable/development DB input only.
-- Same-time rows intentionally exercise projection ordering, not round creation policy.
BEGIN;
INSERT INTO auction.rounds (
    round_id, round_version, status, recruitment_opens_at, publication_at, scheduled_starts_at,
    published_at, actual_started_at, completed_at, cancelled_at, lane_count,
    preparation_seconds, initial_bid_seconds, followup_bid_seconds, durations_frozen
)
SELECT 'discovery-' || lpad(i::text, 3, '0'), 1234567890123456789012345678901234567890,
       (ARRAY['PUBLISHED','WAITING','ACTIVE','COMPLETED','CANCELLED'])[i % 5 + 1],
       '2099-12-01T00:00:00Z'::timestamptz, '2099-12-31T15:00:00Z'::timestamptz,
       '2100-01-02T01:00:00.123456Z'::timestamptz + CASE WHEN i >= 42 THEN interval '1 microsecond' ELSE interval '0' END,
       '2099-12-31T15:00:00Z'::timestamptz,
       CASE WHEN i % 5 IN (2,3) THEN '2100-01-02T01:00:01.654321Z'::timestamptz END,
       CASE WHEN i % 5 = 3 THEN '2100-01-02T01:30:00.000001Z'::timestamptz END,
       CASE WHEN i % 5 = 4 THEN '2100-01-01T00:00:00.000001Z'::timestamptz END,
       i % 4 + 1, 5, 10, 5, i % 5 IN (2,3)
FROM generate_series(0,46) AS i
ON CONFLICT (round_id) DO NOTHING;

INSERT INTO auction.rounds (
    round_id, round_version, status, recruitment_opens_at, publication_at, scheduled_starts_at,
    published_at, lane_count, preparation_seconds, initial_bid_seconds, followup_bid_seconds, durations_frozen
)
SELECT id, 1234567890123456789012345678901234567890, 'PUBLISHED',
       '2099-12-01T00:00:00Z', '2099-12-31T15:00:00Z',
       CASE WHEN id = ' QA/한글 +%?#= ' THEN '2100-01-03T01:00:00.123456Z'::timestamptz
            ELSE '2100-01-04T01:00:00.123456Z'::timestamptz END,
       '2099-12-31T15:00:00Z', 4, 5, 10, 5, false
FROM (VALUES (' QA/한글 +%?#= '), ('DISCOVERY-TIE'), ('discovery-Tie'), ('한글-동률'), (' discovery-tie ')) AS ids(id)
ON CONFLICT (round_id) DO NOTHING;

INSERT INTO auction.rounds (
    round_id, round_version, status, recruitment_opens_at, publication_at, scheduled_starts_at,
    published_at, lane_count, preparation_seconds, initial_bid_seconds, followup_bid_seconds, durations_frozen
)
SELECT id, 0, state, '2000-01-01T00:00:00Z', '2000-01-02T00:00:00Z', '2000-01-03T00:00:00Z',
       CASE WHEN fact THEN '2000-01-02T00:00:00Z'::timestamptz END, 4, 5, 10, 5, false
FROM (VALUES ('discovery-hidden-no-fact', 'PUBLISHED', false),
             ('discovery-hidden-cancelled', 'CANCELLED', false),
             ('discovery-hidden-scheduled', 'SCHEDULED', true),
             ('discovery-hidden-recruiting', 'RECRUITING', true)) AS hidden(id,state,fact)
ON CONFLICT (round_id) DO NOTHING;
COMMIT;
