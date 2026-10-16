package com.auctionplatform.query.application;

import com.auctionplatform.query.publicapi.PublicRoundState;
import java.util.Optional;
import java.util.List;
import java.time.Instant;

/** Read-only projection port. No publication or round mutation is exposed. */
public interface PublicRoundReader {
    Optional<PublicRoundState> findPublished(String exactRoundId);
    List<PublicRoundState> findPublishedAfter(Position after, int limit);

    record Position(Instant scheduledStartsAt, String roundId) {}
}
