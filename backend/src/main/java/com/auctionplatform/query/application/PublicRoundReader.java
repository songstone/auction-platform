package com.auctionplatform.query.application;

import com.auctionplatform.query.publicapi.PublicRoundState;
import java.util.Optional;

/** Read-only projection port. No publication or round mutation is exposed. */
public interface PublicRoundReader {
    Optional<PublicRoundState> findPublished(String exactRoundId);
}
