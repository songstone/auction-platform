package com.auctionplatform.bootstrap.http;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;
import java.io.IOException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

/** The five-field Problem contract. Never serialize exceptions or submitted values. */
@Component
public final class ProblemResponses {
    public static final String TRACE_ATTRIBUTE = ProblemResponses.class.getName() + ".traceId";
    private final JsonMapper json;
    public ProblemResponses(JsonMapper json) { this.json = json; }

    public Problem create(HttpServletRequest request, String code, String message, List<FieldViolation> errors) {
        Object trace = request.getAttribute(TRACE_ATTRIBUTE);
        return new Problem(code, message, trace instanceof String id ? id : UUID.randomUUID().toString(),
                Instant.now().truncatedTo(ChronoUnit.MICROS).toString(), List.copyOf(errors));
    }

    public void write(HttpServletRequest request, HttpServletResponse response, int status,
                      String code, String message) throws IOException {
        response.setStatus(status);
        response.setHeader("Cache-Control", "no-store");
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        json.writeValue(response.getOutputStream(), create(request, code, message, List.of()));
    }

    public record FieldViolation(String field, String reason) {}
    public record Problem(String code, String message, String traceId, String serverTime,
                          List<FieldViolation> fieldErrors) {}
}
