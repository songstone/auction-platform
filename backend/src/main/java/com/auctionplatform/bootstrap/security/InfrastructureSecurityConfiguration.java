package com.auctionplatform.bootstrap.security;

import com.auctionplatform.bootstrap.http.ProblemResponses;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.tomcat.servlet.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityCustomizer;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CsrfException;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;

/** Public round read only. Other capabilities remain closed pending identity implementation. */
@Configuration(proxyBeanMethods = false)
class InfrastructureSecurityConfiguration {
    @Bean
    WebServerFactoryCustomizer<TomcatServletWebServerFactory> preserveEncodedRoundIdentifier() {
        // Keep %2F as data until Spring's per-segment path decoding. Never decode it into a route separator.
        return factory -> factory.addConnectorCustomizers(connector -> connector.setEncodedSolidusHandling("passthrough"));
    }

    @Bean
    WebSecurityCustomizer scopedIdentifierFirewall(ProblemResponses problems) {
        return web -> web.httpFirewall(new PublicRoundHttpFirewall())
                .requestRejectedHandler((request, response, exception) ->
                        problems.write(request, response, 400, "VALIDATION_FAILED", "Invalid request path or headers."));
    }

    @Bean
    SecurityFilterChain infrastructureSecurity(HttpSecurity http, ProblemResponses problems) throws Exception {
        HttpSessionCsrfTokenRepository csrfTokens = new HttpSessionCsrfTokenRepository();
        csrfTokens.setHeaderName("X-CSRF-Token");
        return http
                .authorizeHttpRequests(requests -> requests
                        .requestMatchers(HttpMethod.GET, "/actuator/health").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/rounds/{roundId}").permitAll()
                        .anyRequest().denyAll())
                .csrf(csrf -> csrf.csrfTokenRepository(csrfTokens))
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, exception) ->
                                problems.write(request, response, 403, "ROLE_REQUIRED", "This operation is not available."))
                        .accessDeniedHandler((request, response, exception) -> {
                            boolean invalidCsrf = exception instanceof CsrfException;
                            problems.write(request, response, 403, invalidCsrf ? "CSRF_INVALID" : "ROLE_REQUIRED",
                                    invalidCsrf ? "A valid CSRF token is required." : "This operation is not available.");
                        }))
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .requestCache(AbstractHttpConfigurer::disable)
                // Keep CSRF and the framework's security response headers enabled.
                .build();
    }
}
