package com.auctionplatform.query.publicapi;

/** Public contract 0.1.0. Times and unbounded counters retain their wire representation. */
public record PublicRoundState(
        String roundId, String roundVersion, String status,
        String recruitmentOpensAt, String publicationAt, String scheduledStartsAt,
        String actualStartedAt, String completedAt, String cancelledAt,
        int laneCount, Durations durations, boolean durationsFrozen) {
    public record Durations(int preparationSeconds, int initialBidSeconds, int followupBidSeconds) {}
}
