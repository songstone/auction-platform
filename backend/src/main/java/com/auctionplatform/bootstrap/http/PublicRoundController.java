package com.auctionplatform.bootstrap.http;

import com.auctionplatform.query.application.PublicRoundQuery;
import com.auctionplatform.query.publicapi.PublicRoundState;
import com.auctionplatform.query.publicapi.PublicRoundPage;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;

@RestController
class PublicRoundController {
    private final PublicRoundQuery query;
    PublicRoundController(PublicRoundQuery query) { this.query = query; }

    @GetMapping("/api/v1/rounds")
    PublicRoundPage list(@RequestParam(required = false) String cursor) { return query.list(cursor); }

    @GetMapping("/api/v1/rounds/{roundId}")
    PublicRoundState get(@PathVariable String roundId) { return query.get(roundId); }
}
