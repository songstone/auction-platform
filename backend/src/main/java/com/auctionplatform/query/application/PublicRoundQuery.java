package com.auctionplatform.query.application;

import com.auctionplatform.query.publicapi.PublicRoundState;
import java.util.regex.Pattern;

public final class PublicRoundQuery {
    private static final Pattern NON_WHITESPACE = Pattern.compile("\\S", Pattern.UNICODE_CHARACTER_CLASS);
    private final PublicRoundReader reader;

    public PublicRoundQuery(PublicRoundReader reader) { this.reader = reader; }

    public PublicRoundState get(String roundId) {
        if (roundId == null || !NON_WHITESPACE.matcher(roundId).find()) throw new InvalidId();
        // OpaqueId is exact and case-sensitive. Never trim or normalize it.
        return reader.findPublished(roundId).orElseThrow(NotFound::new);
    }

    public static final class InvalidId extends RuntimeException {}
    public static final class NotFound extends RuntimeException {}
    public static final class Unavailable extends RuntimeException {}
}
