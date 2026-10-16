package com.auctionplatform.bootstrap.http;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.UUID;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
class RequestTraceFilter extends OncePerRequestFilter {
    private static final Logger LOG = LoggerFactory.getLogger(RequestTraceFilter.class);

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String traceId = UUID.randomUUID().toString();
        request.setAttribute(ProblemResponses.TRACE_ATTRIBUTE, traceId);
        response.setHeader("X-Trace-Id", traceId);
        response.setHeader("Cache-Control", "no-store");
        long started = System.nanoTime();
        try {
            chain.doFilter(request, response);
        } finally {
            // Raw URI, query, headers, submitted values and exception text are intentionally absent.
            LOG.info("http_request traceId={} status={} durationMs={}", traceId, response.getStatus(),
                    (System.nanoTime() - started) / 1_000_000);
        }
    }
}
