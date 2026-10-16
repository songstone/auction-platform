package com.auctionplatform.bootstrap.http;

import com.auctionplatform.query.application.PublicRoundQuery;
import com.auctionplatform.query.publicapi.PublicRoundState;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
class PublicRoundController {
    private final PublicRoundQuery query;
    PublicRoundController(PublicRoundQuery query) { this.query = query; }

    @GetMapping("/api/v1/rounds/{roundId}")
    PublicRoundState get(@PathVariable String roundId) { return query.get(roundId); }
}
