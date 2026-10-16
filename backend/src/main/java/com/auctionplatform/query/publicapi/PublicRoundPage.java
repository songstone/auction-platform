package com.auctionplatform.query.publicapi;

import java.util.List;

/** Closed public contract 0.1.0; a null cursor means this traversal has reached its end. */
public record PublicRoundPage(List<PublicRoundState> items, String nextCursor) {
    public PublicRoundPage { items = List.copyOf(items); }
}
