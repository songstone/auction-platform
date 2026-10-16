package com.auctionplatform.bootstrap.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.web.firewall.FirewalledRequest;
import org.springframework.security.web.firewall.HttpFirewall;
import org.springframework.security.web.firewall.StrictHttpFirewall;

/** Permit encoded identifier data only in the one implemented public GET route. */
final class PublicRoundHttpFirewall implements HttpFirewall {
    private static final String PREFIX = "/api/v1/rounds/";
    private final StrictHttpFirewall strict = new StrictHttpFirewall();
    private final StrictHttpFirewall roundRead = new StrictHttpFirewall();

    PublicRoundHttpFirewall() {
        roundRead.setAllowUrlEncodedSlash(true);
        roundRead.setAllowUrlEncodedPercent(true);
    }

    @Override
    public FirewalledRequest getFirewalledRequest(HttpServletRequest request) {
        String uri = request.getRequestURI();
        boolean exactRoute = "GET".equals(request.getMethod()) && uri.startsWith(PREFIX)
                && uri.length() > PREFIX.length() && uri.indexOf('/', PREFIX.length()) < 0;
        // Headers, methods, normalization and all other StrictHttpFirewall checks remain enabled.
        return (exactRoute ? roundRead : strict).getFirewalledRequest(request);
    }

    @Override
    public HttpServletResponse getFirewalledResponse(HttpServletResponse response) {
        return strict.getFirewalledResponse(response);
    }
}
