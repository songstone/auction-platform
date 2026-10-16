# Implementation instructions

## Baseline and scope

- Read the current `docs/implementation/IMPLEMENTATION-PLAN.md` and the relevant approved contract before implementing a feature.
- Product/architecture/decision/contract files are the approved baseline. Check `python scripts/check-approved-baseline.py --strict-evidence`. Follow ADR-005 for semantic changes; never update hashes to hide a mismatch.
- Current stack: Amazon Corretto 25, Spring Boot 4.1.1, Gradle Wrapper 9.8.1, Spring MVC/JDBC, PostgreSQL, React/TypeScript. Logical module rules are in `backend/MODULE-BOUNDARIES.md`.
- Keep existing uncommitted work. Do not copy SPIKE code or experimental guarantees into the application without checking its evidence and the approved design.

## Shared files and data

- One owner coordinates `backend/build.gradle.kts`, dependency locks, security/bootstrap configuration, `db/migration`, `scripts/**`, and `.github/**` during parallel work.
- `auction` owns round records. `query` may own a read-only SQL projection; it must not use another feature's internal repository or write its records.
- Migrations contain schema changes, not demo accounts or example rounds. Never rewrite an already applied migration: add the next version.
- `infra/fixtures` contains explicit synthetic data for the dedicated development or disposable test DB. It is not an application resource. Never seed an external/production DB through development scripts.
- Generate FE types from the approved OpenAPI; do not edit generated files or invent an alternative contract. Unknown response fields are rejected by the consumer.
- Keep secrets out of Git, logs, URLs, command arguments and test evidence. Use runtime environment injection or local ignored secrets.

## Verification and handoff

- `scripts/verify.ps1` runs the fast contract/BE/FE checks. `-Integration` also requires Docker and runs PostgreSQL and browser integration checks. Use `-JavaHome` or `AUCTION_JAVA_HOME` with Corretto 25.
- Backend PostgreSQL cases use the explicit `integrationTest` Gradle task; no Docker means failure, not a successful skipped verification.
- The portable `scripts/verify-integration.py` starts only disposable test infrastructure and closes its processes/container. It never uses the development database.
- Report exact commit, commands, result artifacts, failures, and NOT_RUN scope. Distinguish contract/static, real DB/HTTP, browser, and failure-recovery evidence.
- A read-only round query or successful health check is not evidence for bidding, authentication sessions, SSE, official receipt order, or production readiness.
- Keep historical verification reports intact. Add a new report for the current work and update the current guide links.
