package com.auctionplatform.bootstrap;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration;

/** Process bootstrap only; business use cases and contract endpoints are not implemented. */
@SpringBootApplication(
        scanBasePackages = "com.auctionplatform",
        exclude = UserDetailsServiceAutoConfiguration.class)
public class AuctionPlatformApplication {
    public static void main(String[] args) {
        SpringApplication.run(AuctionPlatformApplication.class, args);
    }
}
