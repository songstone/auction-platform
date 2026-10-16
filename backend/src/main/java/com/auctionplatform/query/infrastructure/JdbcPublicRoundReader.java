package com.auctionplatform.query.infrastructure;

import com.auctionplatform.query.application.PublicRoundReader;
import com.auctionplatform.query.publicapi.PublicRoundState;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.Optional;

/** Explicit read-only SQL projection across the auction-owned storage boundary. */
public class JdbcPublicRoundReader implements PublicRoundReader {
    private final JdbcTemplate jdbc;

    public JdbcPublicRoundReader(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Override
    @Transactional(readOnly = true)
    public Optional<PublicRoundState> findPublished(String exactRoundId) {
        return jdbc.query("""
                SELECT round_id, round_version, status, recruitment_opens_at, publication_at,
                       scheduled_starts_at, actual_started_at, completed_at, cancelled_at,
                       lane_count, preparation_seconds, initial_bid_seconds, followup_bid_seconds,
                       durations_frozen
                  FROM auction.rounds
                 WHERE round_id = ? AND published_at IS NOT NULL
                   AND status IN ('PUBLISHED', 'WAITING', 'ACTIVE', 'COMPLETED', 'CANCELLED')
                """, (row, index) -> new PublicRoundState(
                row.getString("round_id"), row.getBigDecimal("round_version").toBigIntegerExact().toString(),
                row.getString("status"), instant(row, "recruitment_opens_at"), instant(row, "publication_at"),
                instant(row, "scheduled_starts_at"), instant(row, "actual_started_at"),
                instant(row, "completed_at"), instant(row, "cancelled_at"), row.getInt("lane_count"),
                new PublicRoundState.Durations(row.getInt("preparation_seconds"), row.getInt("initial_bid_seconds"),
                        row.getInt("followup_bid_seconds")), row.getBoolean("durations_frozen")), exactRoundId)
                .stream().findFirst();
    }

    private static String instant(ResultSet row, String column) throws SQLException {
        OffsetDateTime value = row.getObject(column, OffsetDateTime.class);
        return value == null ? null : value.toInstant().toString();
    }
}
