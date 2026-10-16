package com.auctionplatform.bootstrap;

import com.auctionplatform.query.application.PublicRoundQuery;
import com.auctionplatform.query.application.PublicRoundReader;
import com.auctionplatform.query.infrastructure.JdbcPublicRoundReader;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration(proxyBeanMethods = false)
class PublicRoundConfiguration {
    @Bean PublicRoundQuery publicRoundQuery(PublicRoundReader reader) { return new PublicRoundQuery(reader); }

    @Bean
    @Profile("local-infra")
    PublicRoundReader jdbcPublicRoundReader(JdbcTemplate jdbc) { return new JdbcPublicRoundReader(jdbc); }

    @Bean
    @Profile("!local-infra")
    PublicRoundReader unavailablePublicRoundReader() {
        return id -> { throw new PublicRoundQuery.Unavailable(); };
    }
}
