package com.auctionplatform.bootstrap;

import com.github.dockerjava.api.model.ExposedPort;
import com.github.dockerjava.api.model.PortBinding;
import com.github.dockerjava.api.model.Ports;
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
import java.net.ServerSocket;
import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

@Tag("integration")
@Testcontainers
@ActiveProfiles("local-infra")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class PublicRoundPostgresIntegrationTest {
    private static final AtomicBoolean FIRST_SETUP = new AtomicBoolean(true);
    private static final int DATABASE_PORT = unusedLocalPort();
    @Container
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer(DockerImageName.parse(
            "postgres:18.6-alpine@sha256:77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873")
            .asCompatibleSubstituteFor("postgres"))
            // The development user matches the schema created by the first migration.
            .withUsername("auction")
            // Docker may reassign a dynamic host port on stop/start. Keep this disposable DB's endpoint stable.
            .withCreateContainerCmdModifier(command -> command.getHostConfig().withPortBindings(
                    new PortBinding(Ports.Binding.bindIpAndPort("127.0.0.1", DATABASE_PORT), ExposedPort.tcp(5432))));

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.datasource.hikari.connection-timeout", () -> "1000");
        registry.add("spring.datasource.hikari.validation-timeout", () -> "500");
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
    void emptyPublicListHasAnExplicitEndAndClosedSchema() {
        jdbc.execute("TRUNCATE TABLE auction.rounds");
        JsonNode body = assertPage(list(null));
        assertThat(body.get("items").isEmpty()).isTrue();
        assertThat(body.get("nextCursor").isNull()).isTrue();
    }

    @Test
    void publicListUsesPersistedPublicationAndAllowedStatesWithoutAdvancingRecords() {
        jdbc.execute("TRUNCATE TABLE auction.rounds");
        List<String> allowed = List.of("PUBLISHED", "WAITING", "ACTIVE", "COMPLETED", "CANCELLED");
        for (String status : allowed) insert("public-" + status, status, true);
        insert("private-future", "PUBLISHED", false);
        insert("private-past", "PUBLISHED", false);
        insert("private-cancelled", "CANCELLED", false);
        insert("private-scheduled", "SCHEDULED", true);
        insert("private-recruiting", "RECRUITING", true);
        jdbc.update("""
                UPDATE auction.rounds SET recruitment_opens_at='2000-10-01T00:00:00Z',
                  publication_at='2000-10-14T15:00:00Z', scheduled_starts_at='2000-10-16T01:00:00Z'
                WHERE round_id='private-past'
                """);
        List<Map<String, Object>> before = jdbc.queryForList("SELECT * FROM auction.rounds ORDER BY round_id");
        JsonNode page = assertPage(list(null));
        assertThat(ids(page)).containsExactly("public-ACTIVE", "public-CANCELLED", "public-COMPLETED",
                "public-PUBLISHED", "public-WAITING");
        assertThat(page.get("nextCursor").isNull()).isTrue();
        for (JsonNode item : page.get("items")) {
            assertThat(item).isEqualTo(json.readTree(get(item.get("roundId").asString()).getBody()));
        }
        assertThat(jdbc.queryForList("SELECT * FROM auction.rounds ORDER BY round_id")).isEqualTo(before);
    }

    @Test
    void repeatedPaginationPreservesTupleOrderEveryIdentifierAndMicrosecondsWithoutDuplicates() {
        jdbc.execute("TRUNCATE TABLE auction.rounds");
        List<String> expected = new ArrayList<>();
        String boundaryId = "round-019 /한글 +% " + "x".repeat(512);
        for (int i = 0; i < 47; i++) {
            expected.add(i == 19 ? boundaryId : (i < 42 ? "round-" : "earlier-id-later-time-") + "%03d".formatted(i));
        }
        // Reverse insertion order prevents insertion order from accidentally satisfying the expectation.
        for (int i = expected.size() - 1; i >= 0; i--) {
            insert(expected.get(i), "PUBLISHED", true);
            jdbc.update("UPDATE auction.rounds SET scheduled_starts_at=? WHERE round_id=?",
                    OffsetDateTime.parse(i < 42 ? "2099-10-16T01:00:00.123456Z" : "2099-10-16T01:00:00.123457Z"),
                    expected.get(i));
        }
        assertThat(traverse()).containsExactlyElementsOf(expected);
        assertThat(traverse()).containsExactlyElementsOf(expected);
        assertThat(json.readTree(get(boundaryId).getBody()).get("roundId").asString()).isEqualTo(boundaryId);
        JsonNode first = assertPage(list(null));
        assertThat(first.get("items").size()).isLessThan(expected.size());
        for (JsonNode item : first.get("items")) {
            assertThat(item.get("roundVersion").isString()).isTrue();
            assertThat(item.get("roundVersion").asString()).isEqualTo("9007199254740993");
            assertThat(item.get("scheduledStartsAt").asString()).isEqualTo("2099-10-16T01:00:00.123456Z");
        }
        String cursor = first.get("nextCursor").asString();
        assertThat(list(cursor).getBody()).isEqualTo(list(cursor).getBody());
        // A returned continuation remains usable if all later rows have since gone away.
        jdbc.execute("TRUNCATE TABLE auction.rounds");
        JsonNode end = assertPage(list(cursor));
        assertThat(end.get("items").isEmpty()).isTrue();
        assertThat(end.get("nextCursor").isNull()).isTrue();
    }

    @Test
    void listTieBreakPreservesCaseWhitespaceAndUnicodeWithoutNormalizingIdentifiers() {
        jdbc.execute("TRUNCATE TABLE auction.rounds");
        for (String id : List.of("한글", "a", "Z", "A", " A ")) insert(id, "PUBLISHED", true);
        assertThat(ids(assertPage(list(null)))).containsExactly(" A ", "A", "Z", "a", "한글");
    }

    @Test
    void aFullLastPageHasNoSpuriousContinuation() {
        jdbc.execute("TRUNCATE TABLE auction.rounds");
        for (int i = 0; i < 40; i++) insert("full-page-%03d".formatted(i), "PUBLISHED", true);
        JsonNode first = assertPage(list(null));
        JsonNode last = assertPage(list(first.get("nextCursor").asString()));
        assertThat(last.get("items").size()).isEqualTo(first.get("items").size());
        assertThat(last.get("nextCursor").isNull()).isTrue();
        List<String> all = ids(first);
        all.addAll(ids(last));
        assertThat(all).hasSize(40).doesNotHaveDuplicates();
    }

    @Test
    void malformedAndForeignCursorsReturnOnlyTheFixedValidationProblem() {
        for (String cursor : List.of("", " ", "cursor_demo_3_8_1_1_1", "public-rounds-v2.abc",
                "public-rounds-v1.!", "public-rounds-v1._w", encodedCursor("not-a-date\nprivate-looking-id"),
                encodedCursor("2099-10-16T01:00:00Z\n "), encodedCursor("2099-10-16T01:00:00Z\nid\0"),
                encodedCursor("2099-10-16T01:00:00.1234567Z\nid"), encodedCursor("2099-10-16T10:00:00+09:00\nid"),
                encodedCursor("2099-10-16T01:00:00Z\nid") + "=", "' OR 1=1 --")) {
            ResponseEntity<String> response = list(cursor);
            assertProblem(response, 400, "VALIDATION_FAILED");
            assertThat(json.readTree(response.getBody()).get("fieldErrors").get(0).get("field").asString())
                    .isEqualTo("cursor");
            assertThat(response.getBody()).doesNotContain("private-looking-id", "SELECT", "SQLException");
        }
    }

    @Test
    void boundCursorIdentifierCannotInjectSql() {
        String cursor = encodedCursor("2099-10-16T01:00:00Z\n' OR 1=1 --");
        JsonNode page = assertPage(list(cursor));
        assertThat(ids(page)).containsExactly("demo-round");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM auction.rounds", Integer.class)).isEqualTo(2);
    }

    @Test
    void stoppedDatabaseReturnsUnavailableThenTheSameServerRecovers() {
        assertPage(list(null));
        POSTGRES.getDockerClient().stopContainerCmd(POSTGRES.getContainerId()).withTimeout(1).exec();
        try {
            ResponseEntity<String> response = list(null);
            assertProblem(response, 503, "SERVICE_UNAVAILABLE");
            assertThat(response.getBody()).doesNotContain("SELECT", "jdbc:", "auction.rounds", "SQLException");
        } finally {
            POSTGRES.getDockerClient().startContainerCmd(POSTGRES.getContainerId()).exec();
            assertThat(POSTGRES.getDockerClient().inspectContainerCmd(POSTGRES.getContainerId()).exec()
                    .getNetworkSettings().getPorts().getBindings().get(ExposedPort.tcp(5432))[0].getHostPortSpec())
                    .isEqualTo(Integer.toString(DATABASE_PORT));
            await().atMost(Duration.ofSeconds(30)).pollInterval(Duration.ofMillis(250)).untilAsserted(() -> {
                assertThat(ids(assertPage(list(null)))).containsExactly("demo-round");
            });
        }
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

    private ResponseEntity<String> list(String cursor) {
        return http.getForEntity(URI.create(http.getRootUri() + "/api/v1/rounds"
                + (cursor == null ? "" : "?cursor=" + UriUtils.encodeQueryParam(cursor, StandardCharsets.UTF_8))), String.class);
    }

    private JsonNode assertPage(ResponseEntity<String> response) {
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
        assertThat(response.getHeaders().getFirst("X-Trace-Id")).isNotBlank();
        JsonNode body = json.readTree(response.getBody());
        assertThat(body.properties().stream().map(Map.Entry::getKey).collect(Collectors.toSet()))
                .isEqualTo(Set.of("items", "nextCursor"));
        assertThat(body.get("items").isArray()).isTrue();
        for (JsonNode item : body.get("items")) {
            assertThat(item.properties().stream().map(Map.Entry::getKey).collect(Collectors.toSet())).isEqualTo(Set.of(
                    "roundId", "roundVersion", "status", "recruitmentOpensAt", "publicationAt", "scheduledStartsAt",
                    "actualStartedAt", "completedAt", "cancelledAt", "laneCount", "durations", "durationsFrozen"));
        }
        return body;
    }

    private List<String> ids(JsonNode page) {
        List<String> ids = new ArrayList<>();
        for (JsonNode item : page.get("items")) ids.add(item.get("roundId").asString());
        return ids;
    }

    private List<String> traverse() {
        List<String> seen = new ArrayList<>();
        String cursor = null;
        int pages = 0;
        do {
            JsonNode page = assertPage(list(cursor));
            seen.addAll(ids(page));
            assertThat(seen).doesNotHaveDuplicates();
            cursor = page.get("nextCursor").isNull() ? null : page.get("nextCursor").asString();
            assertThat(++pages).isLessThan(20);
        } while (cursor != null);
        assertThat(pages).isGreaterThan(1);
        return seen;
    }

    private static String encodedCursor(String payload) {
        return "public-rounds-v1." + Base64.getUrlEncoder().withoutPadding()
                .encodeToString(payload.getBytes(StandardCharsets.UTF_8));
    }

    private static int unusedLocalPort() {
        try (ServerSocket socket = new ServerSocket(0)) {
            return socket.getLocalPort();
        } catch (IOException unavailable) {
            throw new ExceptionInInitializerError(unavailable);
        }
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
