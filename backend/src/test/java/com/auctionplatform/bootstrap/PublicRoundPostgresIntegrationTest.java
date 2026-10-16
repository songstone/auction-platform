package com.auctionplatform.bootstrap;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.util.UriUtils;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

@Tag("integration")
@Testcontainers
@ActiveProfiles("local-infra")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class PublicRoundPostgresIntegrationTest {
    private static final AtomicBoolean FIRST_SETUP = new AtomicBoolean(true);
    @Container
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer(DockerImageName.parse(
            "postgres:18.6-alpine@sha256:77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873")
            .asCompatibleSubstituteFor("postgres"));

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired JdbcTemplate jdbc;
    @Autowired Flyway flyway;
    @Autowired TestRestTemplate http;
    @Autowired JsonMapper json;

    @BeforeEach
    void seedOnlyTheIsolatedTestDatabase() {
        if (FIRST_SETUP.getAndSet(false)) {
            assertThat(flyway.info().applied()).hasSize(1);
            assertThat(jdbc.queryForObject("SELECT count(*) FROM auction.rounds", Integer.class)).isZero();
        }
        jdbc.execute("TRUNCATE TABLE auction.rounds");
        insert("demo-round", "PUBLISHED", true);
        insert("demo-hidden", "RECRUITING", false);
    }

    @Test
    void publicResponsePreservesTheContractAndLargeCounter() {
        ResponseEntity<String> response = get("demo-round");
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
        JsonNode body = json.readTree(response.getBody());
        assertThat(body.properties().stream().map(Map.Entry::getKey).collect(Collectors.toSet())).isEqualTo(Set.of(
                "roundId", "roundVersion", "status", "recruitmentOpensAt", "publicationAt", "scheduledStartsAt",
                "actualStartedAt", "completedAt", "cancelledAt", "laneCount", "durations", "durationsFrozen"));
        assertThat(body.get("roundId").asString()).isEqualTo("demo-round");
        assertThat(body.get("roundVersion").isString()).isTrue();
        assertThat(body.get("roundVersion").asString()).isEqualTo("9007199254740993");
        assertThat(body.get("status").asString()).isEqualTo("PUBLISHED");
        assertThat(body.get("publicationAt").asString()).isEqualTo("2099-10-14T15:00:00Z");
        assertThat(body.get("scheduledStartsAt").asString()).isEqualTo("2099-10-16T01:00:00Z");
        assertThat(body.get("laneCount").asInt()).isEqualTo(4);
        assertThat(body.get("actualStartedAt").isNull()).isTrue();
        assertThat(body.get("completedAt").isNull()).isTrue();
        assertThat(body.get("cancelledAt").isNull()).isTrue();
        assertThat(body.get("durationsFrozen").asBoolean()).isFalse();
        assertThat(body.get("durations")).isEqualTo(json.readTree(
                "{\"preparationSeconds\":5,\"initialBidSeconds\":10,\"followupBidSeconds\":5}"));
    }

    @Test
    void missingAndUnpublishedHaveTheSameNotFoundMeaningEvenAfterScheduledPublication() {
        jdbc.update("""
                UPDATE auction.rounds SET status='PUBLISHED', recruitment_opens_at='2000-10-01T00:00:00Z',
                  publication_at='2000-10-14T15:00:00Z', scheduled_starts_at='2000-10-16T01:00:00Z'
                WHERE round_id='demo-hidden'
                """);
        for (String id : new String[]{"demo-hidden", "demo-missing"}) {
            assertProblem(get(id), 404, "RESOURCE_NOT_FOUND");
        }
        assertThat(json.readTree(get("demo-hidden").getBody()).get("message"))
                .isEqualTo(json.readTree(get("demo-missing").getBody()).get("message"));
    }

    @Test
    void opaqueIdentifiersAreCaseSensitiveAndNeverTrimmed() {
        assertProblem(get("DEMO-ROUND"), 404, "RESOURCE_NOT_FOUND");
        assertProblem(get(" demo-round "), 404, "RESOURCE_NOT_FOUND");
        insert(" demo-round ", "PUBLISHED", true);
        assertThat(json.readTree(get(" demo-round ").getBody()).get("roundId").asString()).isEqualTo(" demo-round ");
        assertProblem(get("   "), 400, "VALIDATION_FAILED");
    }

    @Test
    void opaqueIdentifierCanRoundTripReservedAndUnicodeCharacters() {
        String id = " Round/한글 +% ";
        insert(id, "PUBLISHED", true);
        ResponseEntity<String> response = get(id);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(json.readTree(response.getBody()).get("roundId").asString()).isEqualTo(id);
    }

    @Test
    void microsecondsAndUtcArePreserved() {
        jdbc.update("""
                UPDATE auction.rounds SET status='ACTIVE', durations_frozen=true,
                  actual_started_at='2099-10-16T10:00:01.123456+09:00' WHERE round_id='demo-round'
                """);
        JsonNode body = json.readTree(get("demo-round").getBody());
        assertThat(body.get("actualStartedAt").asString()).isEqualTo("2099-10-16T01:00:01.123456Z");
        assertThat(body.get("scheduledStartsAt").asString()).isEqualTo("2099-10-16T01:00:00Z");
        assertThat(body.get("durationsFrozen").asBoolean()).isTrue();
    }

    @Test
    void databaseFailureIsUnavailableWithoutSqlOrIdentifierDisclosure() {
        jdbc.execute("ALTER TABLE auction.rounds RENAME TO rounds_unavailable_test");
        try {
            ResponseEntity<String> response = get("private-looking-id");
            assertProblem(response, 503, "SERVICE_UNAVAILABLE");
            assertThat(response.getBody()).doesNotContain("SELECT", "auction.rounds", "private-looking-id", "SQLException");
        } finally {
            jdbc.execute("ALTER TABLE auction.rounds_unavailable_test RENAME TO rounds");
        }
    }

    @Test
    void freshDatabaseMigrationAndApplicationRestartPreserveData() throws Exception {
        assertThat(flyway.info().applied()).hasSize(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM public.flyway_schema_history WHERE success", Integer.class)).isEqualTo(1);
        assertThat(flyway.migrate().migrationsExecuted).isZero();
        StandardEnvironment environment = new StandardEnvironment();
        environment.getPropertySources().addFirst(new MapPropertySource("isolated-test", Map.of(
                "spring.profiles.active", "local-infra", "server.port", "0",
                "spring.datasource.url", POSTGRES.getJdbcUrl(), "spring.datasource.username", POSTGRES.getUsername(),
                "spring.datasource.password", POSTGRES.getPassword())));
        SpringApplication application = new SpringApplication(AuctionPlatformApplication.class);
        application.setEnvironment(environment);
        try (ConfigurableApplicationContext restarted = application.run()) {
            String port = restarted.getEnvironment().getProperty("local.server.port");
            try (HttpClient client = HttpClient.newHttpClient()) {
                var response = client.send(HttpRequest.newBuilder(
                        URI.create("http://127.0.0.1:" + port + "/api/v1/rounds/demo-round")).GET().build(),
                        HttpResponse.BodyHandlers.ofString());
                assertThat(response.statusCode()).isEqualTo(200);
                assertThat(json.readTree(response.body()).get("roundVersion").asString()).isEqualTo("9007199254740993");
            }
            assertThat(restarted.getBean(Flyway.class).info().applied()).hasSize(1);
        }
    }

    private ResponseEntity<String> get(String id) {
        return http.getForEntity(URI.create(http.getRootUri() + "/api/v1/rounds/"
                + UriUtils.encodePathSegment(id, StandardCharsets.UTF_8)), String.class);
    }

    private void assertProblem(ResponseEntity<String> response, int status, String code) {
        assertThat(response.getStatusCode().value()).isEqualTo(status);
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
        JsonNode problem = json.readTree(response.getBody());
        assertThat(problem.size()).isEqualTo(5);
        assertThat(problem.get("code").asString()).isEqualTo(code);
        assertThat(problem.get("message").asString()).isNotBlank();
        assertThat(problem.get("traceId").asString()).isEqualTo(response.getHeaders().getFirst("X-Trace-Id"));
        assertThat(problem.get("serverTime").asString()).matches("^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,6})?Z$");
        assertThat(problem.get("fieldErrors").isArray()).isTrue();
    }

    private void insert(String id, String status, boolean published) {
        jdbc.update("""
                INSERT INTO auction.rounds(round_id, round_version, status, recruitment_opens_at,
                  publication_at, scheduled_starts_at, published_at, lane_count,
                  preparation_seconds, initial_bid_seconds, followup_bid_seconds, durations_frozen)
                VALUES (?, 9007199254740993, ?, '2099-10-01T00:00:00Z', '2099-10-14T15:00:00Z',
                  '2099-10-16T01:00:00Z', CASE WHEN ? THEN '2099-10-14T15:00:00Z'::timestamptz ELSE NULL END,
                  4, 5, 10, 5, false)
                """, id, status, published);
    }
}
