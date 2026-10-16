package com.auctionplatform.query.application;

import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.time.DateTimeException;
import java.time.Instant;
import java.util.Base64;
import java.util.regex.Pattern;

/** Internal list-only continuation position. It grants no access and promises no fixed snapshot. */
final class PublicRoundCursor {
    private static final String PREFIX = "public-rounds-v1.";
    private static final Pattern PAYLOAD = Pattern.compile("[A-Za-z0-9_-]+");
    private static final Pattern TIME = Pattern.compile("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,6})?Z");
    private static final Pattern NON_WHITESPACE = Pattern.compile("\\S", Pattern.UNICODE_CHARACTER_CLASS);

    private PublicRoundCursor() {}

    static PublicRoundReader.Position decode(String cursor) {
        if (cursor == null) return null;
        if (!cursor.startsWith(PREFIX) || !PAYLOAD.matcher(cursor.substring(PREFIX.length())).matches()) {
            throw new PublicRoundQuery.InvalidCursor();
        }
        try {
            byte[] bytes = Base64.getUrlDecoder().decode(cursor.substring(PREFIX.length()));
            String payload = StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(bytes)).toString();
            int separator = payload.indexOf('\n');
            if (separator < 0) throw new PublicRoundQuery.InvalidCursor();
            String time = payload.substring(0, separator);
            String id = payload.substring(separator + 1);
            if (!TIME.matcher(time).matches() || !NON_WHITESPACE.matcher(id).find() || id.indexOf('\0') >= 0) {
                throw new PublicRoundQuery.InvalidCursor();
            }
            var position = new PublicRoundReader.Position(Instant.parse(time), id);
            // Require our exact format, including canonical Base64 and timestamp encoding.
            if (!encode(position).equals(cursor)) throw new PublicRoundQuery.InvalidCursor();
            return position;
        } catch (IllegalArgumentException | DateTimeException | CharacterCodingException invalid) {
            throw new PublicRoundQuery.InvalidCursor();
        }
    }

    static String encode(PublicRoundReader.Position position) {
        String payload = position.scheduledStartsAt() + "\n" + position.roundId();
        return PREFIX + Base64.getUrlEncoder().withoutPadding().encodeToString(payload.getBytes(StandardCharsets.UTF_8));
    }
}
