package com.auctionplatform.bootstrap;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.context.ApplicationContext;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.userdetails.UserDetailsService;

import javax.sql.DataSource;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class InfrastructureBoundaryTest {
    @Autowired TestRestTemplate http;
    @Autowired ApplicationContext context;

    @Test
    void healthIsSummaryOnlyAndDoesNotRequireExternalInfrastructure() {
        ResponseEntity<String> response = http.getForEntity("/actuator/health", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo("{\"status\":\"UP\"}");
        assertThat(context.getBeansOfType(DataSource.class)).isEmpty();
    }

    @Test
    void scaffoldingDoesNotExposeBusinessOrManagementSurfaces() {
        for (String path : new String[]{"/api/v1/rounds", "/actuator/env", "/actuator/configprops",
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
}
