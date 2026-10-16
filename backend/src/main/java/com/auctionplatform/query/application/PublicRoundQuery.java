package com.auctionplatform.query.application;

import com.auctionplatform.query.publicapi.PublicRoundState;
import com.auctionplatform.query.publicapi.PublicRoundPage;
import java.time.Instant;
import java.util.regex.Pattern;

public final class PublicRoundQuery {
    private static final Pattern NON_WHITESPACE = Pattern.compile("\\S", Pattern.UNICODE_CHARACTER_CLASS);
    // An internal response batching choice, not a product limit on rounds.
    private static final int PAGE_SIZE = 20;
    private final PublicRoundReader reader;

    public PublicRoundQuery(PublicRoundReader reader) { this.reader = reader; }

    public PublicRoundState get(String roundId) {
        if (roundId == null || !NON_WHITESPACE.matcher(roundId).find()) throw new InvalidId();
        // OpaqueId is exact and case-sensitive. Never trim or normalize it.
        return reader.findPublished(roundId).orElseThrow(NotFound::new);
    }

    public PublicRoundPage list(String cursor) {
        var rows = reader.findPublishedAfter(PublicRoundCursor.decode(cursor), PAGE_SIZE + 1);
        boolean hasMore = rows.size() > PAGE_SIZE;
        var items = hasMore ? rows.subList(0, PAGE_SIZE) : rows;
        String nextCursor = null;
        if (hasMore) {
            PublicRoundState last = items.getLast();
            nextCursor = PublicRoundCursor.encode(new PublicRoundReader.Position(
                    Instant.parse(last.scheduledStartsAt()), last.roundId()));
        }
        return new PublicRoundPage(items, nextCursor);
    }

    public static final class InvalidId extends RuntimeException {}
    public static final class InvalidCursor extends RuntimeException {}
    public static final class NotFound extends RuntimeException {}
    public static final class Unavailable extends RuntimeException {}
}
