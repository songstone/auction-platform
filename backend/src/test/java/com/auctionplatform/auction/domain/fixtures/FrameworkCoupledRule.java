package com.auctionplatform.auction.domain.fixtures;

import org.springframework.jdbc.core.JdbcTemplate;

/** Deliberately invalid test-only dependency; proves that the architecture guard can fail. */
public final class FrameworkCoupledRule {
    private JdbcTemplate forbidden;
}
