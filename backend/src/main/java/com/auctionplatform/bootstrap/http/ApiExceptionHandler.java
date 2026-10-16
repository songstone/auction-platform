package com.auctionplatform.bootstrap.http;

import com.auctionplatform.query.application.PublicRoundQuery;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.TransactionException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import java.util.List;

@RestControllerAdvice
class ApiExceptionHandler {
    private static final Logger LOG = LoggerFactory.getLogger(ApiExceptionHandler.class);
    private final ProblemResponses problems;
    ApiExceptionHandler(ProblemResponses problems) { this.problems = problems; }

    @ExceptionHandler(PublicRoundQuery.InvalidCursor.class)
    ResponseEntity<ProblemResponses.Problem> invalidCursor(HttpServletRequest request) {
        return ResponseEntity.badRequest().body(problems.create(request, "VALIDATION_FAILED", "Invalid list cursor.",
                List.of(new ProblemResponses.FieldViolation("cursor", "A valid public round list cursor is required."))));
    }

    @ExceptionHandler(PublicRoundQuery.InvalidId.class)
    ResponseEntity<ProblemResponses.Problem> invalid(HttpServletRequest request) {
        return ResponseEntity.badRequest().body(problems.create(request, "VALIDATION_FAILED", "Invalid round identifier.",
                List.of(new ProblemResponses.FieldViolation("roundId", "A non-blank identifier is required."))));
    }

    @ExceptionHandler(PublicRoundQuery.NotFound.class)
    ResponseEntity<ProblemResponses.Problem> notFound(HttpServletRequest request) {
        return ResponseEntity.status(404).body(problems.create(request, "RESOURCE_NOT_FOUND",
                "The requested resource is not available.", List.of()));
    }

    @ExceptionHandler({PublicRoundQuery.Unavailable.class, DataAccessException.class, TransactionException.class})
    ResponseEntity<ProblemResponses.Problem> unavailable(HttpServletRequest request) {
        return failure(request, 503, "SERVICE_UNAVAILABLE", "The service is temporarily unavailable.");
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ProblemResponses.Problem> unexpected(HttpServletRequest request) {
        return failure(request, 500, "INTERNAL_ERROR", "The request could not be completed.");
    }

    private ResponseEntity<ProblemResponses.Problem> failure(HttpServletRequest request, int status, String code,
                                                            String message) {
        ProblemResponses.Problem problem = problems.create(request, code, message, List.of());
        LOG.warn("api_failure traceId={} code={}", problem.traceId(), code);
        return ResponseEntity.status(status).body(problem);
    }
}
