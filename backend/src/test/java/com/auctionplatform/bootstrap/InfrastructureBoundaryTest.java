package com.auctionplatform.bootstrap;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.context.ApplicationContext;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpEntity;
import tools.jackson.databind.json.JsonMapper;
import java.net.URI;
import org.springframework.security.core.userdetails.UserDetailsService;

import javax.sql.DataSource;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
@ExtendWith(OutputCaptureExtension.class)
class InfrastructureBoundaryTest {
    @Autowired TestRestTemplate http;
    @Autowired ApplicationContext context;
    @Autowired JsonMapper json;

    @Test
    void healthIsSummaryOnlyAndDoesNotRequireExternalInfrastructure() {
        ResponseEntity<String> response = http.getForEntity("/actuator/health", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo("{\"status\":\"UP\"}");
        assertThat(context.getBeansOfType(DataSource.class)).isEmpty();
    }

    @Test
    void scaffoldingDoesNotExposeBusinessOrManagementSurfaces() {
        for (String path : new String[]{"/api/v1/rounds/", "/api/v1/rounds/demo/extra", "/api/v1/operator/rounds",
                "/api/v1/me/rounds", "/actuator/env", "/actuator/configprops",
                "/actuator/health/liveness", "/actuator/health/readiness", "/login"}) {
            assertThat(http.getForEntity(path, String.class).getStatusCode())
                    .as("bootstrap must deny %s; this is not business-contract coverage", path)
                    .isEqualTo(HttpStatus.FORBIDDEN);
        }
    }

    @Test
    void noDefaultUserOrGeneratedCredentialServiceIsInstalled() {
        assertThat(context.getBeansOfType(UserDetailsService.class)).isEmpty();
    }

    @Test
    void publicReadWithoutDatabaseReturnsUnavailableProblem(CapturedOutput output) {
        ResponseEntity<String> response = http.getForEntity(
                "/api/v1/rounds/do-not-log-round?token=do-not-log-token", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
        var problem = json.readTree(response.getBody());
        assertThat(problem.size()).isEqualTo(5);
        assertThat(problem.get("code").asString()).isEqualTo("SERVICE_UNAVAILABLE");
        assertThat(problem.get("traceId").asString()).isEqualTo(response.getHeaders().getFirst("X-Trace-Id"));
        assertThat(problem.get("serverTime").asString()).matches("^\\d{4}-.*(?:\\.\\d{1,6})?Z$");
        assertThat(output.getAll()).contains(problem.get("traceId").asString())
                .doesNotContain("do-not-log-round", "do-not-log-token");
        assertThat(response.getBody()).doesNotContain("do-not-log-round", "do-not-log-token");
    }

    @Test
    void publicListWithoutDatabaseIsUnavailableAndDoesNotLogQueryOrHeaders(CapturedOutput output) {
        ResponseEntity<String> response = http.getForEntity("/api/v1/rounds?token=do-not-log-list-token", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
        var problem = json.readTree(response.getBody());
        assertThat(problem.size()).isEqualTo(5);
        assertThat(problem.get("code").asString()).isEqualTo("SERVICE_UNAVAILABLE");
        assertThat(problem.get("traceId").asString()).isEqualTo(response.getHeaders().getFirst("X-Trace-Id"));
        assertThat(output.getAll()).contains(problem.get("traceId").asString()).doesNotContain("do-not-log-list-token");
        assertThat(response.getBody()).doesNotContain("do-not-log-list-token");
    }

    @Test
    void malformedListCursorIsRejectedBeforeDatabaseAccessAndNotEchoed(CapturedOutput output) {
        ResponseEntity<String> response = http.getForEntity("/api/v1/rounds?cursor=do-not-log-cursor", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
        var problem = json.readTree(response.getBody());
        assertThat(problem.size()).isEqualTo(5);
        assertThat(problem.get("code").asString()).isEqualTo("VALIDATION_FAILED");
        assertThat(problem.get("traceId").asString()).isEqualTo(response.getHeaders().getFirst("X-Trace-Id"));
        assertThat(problem.get("fieldErrors").get(0).get("field").asString()).isEqualTo("cursor");
        assertThat(output.getAll()).doesNotContain("do-not-log-cursor");
        assertThat(response.getBody()).doesNotContain("do-not-log-cursor");
    }

    @Test
    void publicListDoesNotPermitPostOrHead() {
        assertThat(http.postForEntity("/api/v1/rounds", HttpEntity.EMPTY, String.class).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(http.exchange("/api/v1/rounds", org.springframework.http.HttpMethod.HEAD,
                HttpEntity.EMPTY, String.class).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void blankOpaqueIdIsRejectedBeforeDatabaseAccess() {
        ResponseEntity<String> response = http.getForEntity(
                URI.create(http.getRootUri() + "/api/v1/rounds/%20%20"), String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(json.readTree(response.getBody()).get("code").asString()).isEqualTo("VALIDATION_FAILED");
    }

    @Test
    void unsafeRequestWithoutCsrfUsesContractProblem() {
        ResponseEntity<String> response = http.postForEntity("/api/v1/rounds/demo-round", HttpEntity.EMPTY, String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
        var problem = json.readTree(response.getBody());
        assertThat(problem.size()).isEqualTo(5);
        assertThat(problem.get("code").asString()).isEqualTo("CSRF_INVALID");
    }

    @Test
    void encodedIdentifierAllowanceDoesNotOpenOtherPathsOrMethods() {
        for (String path : new String[]{"/actuator%2Fenv", "/api/v1/rounds%2Fdemo-round",
                "/api/v1/rounds/demo%2Fother/extra", "/api/v1/rounds/%2E%2E%2Factuator"}) {
            ResponseEntity<String> response = http.getForEntity(URI.create(http.getRootUri() + path), String.class);
            assertThat(response.getStatusCode().value()).as(path).isBetween(400, 499);
        }
        ResponseEntity<String> post = http.postForEntity(
                URI.create(http.getRootUri() + "/api/v1/rounds/demo%2Fother"), HttpEntity.EMPTY, String.class);
        assertThat(post.getStatusCode().value()).isEqualTo(400);
        assertThat(json.readTree(post.getBody()).get("code").asString()).isEqualTo("VALIDATION_FAILED");
    }
}
