# 공개 회차 조회 — 개발 기반과 첫 수직 흐름

- 작성일: 2026-10-16
- 입력: D-095, 승인 계약 0.1.0 및 저장소의 승인 manifest. 승인 원본과 생성 타입은 변경하지 않았다.
- 작업 기준: `f5f5a5c3b95e23b63957952237d462b0f58d1416`에서 `feat/public-round-query`로 분기.
- 검증 대상 구현 커밋: `39fb9e147c6e9b04dc5f763f164b6e2c349c4dca`.
- 원격 실행: [GitHub Actions 38833750047](https://github.com/songstone/auction-platform/actions/runs/38833750047), **SUCCESS**. `contracts`, `backend`, `frontend`, `integration` 4개 작업 모두 성공.
- 통합 기준 브랜치: `main`. 위 검증 구현과 이 실행 기록을 fast-forward 방식으로 통합한다.

## 구현 범위

`/?roundId=<ID>` → `GET /api/v1/rounds/{roundId}` → PostgreSQL `auction.rounds` → React 화면을 연결했다. 응답은 승인 `PublicRoundState`의 12개 필드이며 문자열 카운터, 정확한 opaque ID, UTC 마이크로초를 보존한다. FE는 생성 타입과 별도의 닫힌 응답 검사를 사용하고 날짜를 서울 시각으로 표시한다. 브라우저 시각으로 회차 상태를 전이시키지 않는다.

`auction` 소유의 최소 테이블과 `query`의 읽기 전용 SQL projection을 만들었다. 스케줄의 `publication_at`만으로 공개를 판정하지 않고 `published_at`의 공개 사실과 공개 상태를 함께 확인한다. 미공개와 없는 회차는 같은 404 `RESOURCE_NOT_FOUND`다. 빈 식별자는 400, DB 미구성/조회 장애는 503이다. 공통 오류는 `code/message/traceId/serverTime/fieldErrors` 5필드이며 JSON 응답은 `no-store`다.

필요한 인증 구성은 공개 GET의 익명 접근과 다른 업무 경로의 기본 거부다. 실제 로그인·회원 세션은 이번 흐름의 전제조건이 아니다. 기존 CSRF 및 보안 헤더를 유지하며 가짜 로그인이나 테스트 권한 우회를 추가하지 않았다. 로그는 서버 생성 trace ID·상태·소요 시간과 고정 오류 코드만 기록하며 요청 URI·query·body·헤더를 기록하지 않는다.

인코딩된 `/`·`%`를 opaque ID 데이터로 처리하기 위해 Tomcat은 encoded slash를 경로 구분자로 디코딩하지 않고 전달한다. 정확한 공개 GET의 단일 raw segment에만 별도 `StrictHttpFirewall`의 해당 두 옵션을 허용한다. 다른 경로·메서드 및 정규화/헤더/기타 검사는 유지한다. Spring의 세그먼트 단위 해석 후 SQL 파라미터로 조회하며 이중 디코딩을 추가하지 않는다.

기본 프로필은 DB 없이 health를 기동하고 회차 조회에는 503을 반환한다. `local-infra`는 DB 연결과 Flyway를 활성화하며 마이그레이션 실패 시 기동을 중단한다. 마이그레이션에는 샘플·계정·비밀번호가 없다. `infra/seed-demo.ps1`만 전용 개발 Compose DB에 합성 회차를 넣으며 기존 행은 덮어쓰지 않는다.

## 생성·변경 파일

| 위치 | 내용 |
| --- | --- |
| `AGENTS.md`, `.editorconfig`, `README.md` | 공통 소유권·승인 원본 보호·검증 규칙·실행 가이드·인코딩 기준 |
| `backend/build.gradle.kts`, `backend/gradle.lockfile` | Flyway, PostgreSQL Testcontainers 및 명시적 `integrationTest` 작업 |
| `backend/src/main/resources/db/migration/V1__create_auction_round.sql` | 빈 DB의 최소 회차 테이블·제약·소유권 설명 |
| `backend/src/main/resources/application*.yaml`, `backend/.env.example` | 프로필별 Flyway·Hikari 설정 |
| `backend/src/main/java/com/auctionplatform/query/{application,infrastructure,publicapi}/**` | 조회 유스케이스·읽기 포트·JDBC projection·공개 DTO |
| `backend/src/main/java/com/auctionplatform/bootstrap/{PublicRoundConfiguration.java,http/**,security/**}` | 조립·HTTP·공통 오류·추적·한정된 인코딩 처리와 접근 경계 |
| `backend/src/main/java/com/auctionplatform/bootstrap/AuctionPlatformApplication.java` | query 구현 등록 범위 |
| `backend/src/test/java/com/auctionplatform/bootstrap/{InfrastructureBoundaryTest,PublicRoundPostgresIntegrationTest}.java` | 기본 경계와 실제 PostgreSQL 회귀 검사 |
| `backend/README.md`, `backend/MODULE-BOUNDARIES.md` | 실행/검증·읽기 projection 예외·후속 구현 경계 |
| `frontend/src/rounds/**`, `frontend/src/App.tsx`, `frontend/src/styles.css` | API 응답 검사·fetch·loading/정상/오류/재시도 화면·반응형 표시 |
| `frontend/{package.json,package-lock.json,tsconfig.json,vite.config.ts}` | 브라우저 검사 의존성·타입 검사·개발/preview 프록시 |
| `frontend/tests/round-client.test.mjs`, `frontend/e2e/public-round.spec.ts`, `frontend/playwright.config.ts` | 단위 반례와 실제 API Chromium 검사 |
| `frontend/scripts/check-production.mjs`, `frontend/README.md` | 합성 fixture의 배포물 제외·실행 문서 |
| `infra/{fixtures/public-rounds.sql,seed-demo.ps1,README.md}` | 운영/마이그레이션과 분리된 명시적 개발 데이터 |
| `scripts/{verify.ps1,verify-integration.py,verify-public-round-contract.py}` | 전체 검사 명령·격리 DB 수명주기·승인 원본 기반 실제 HTTP 검사 |
| `.github/workflows/verify.yml` | 계약·BE·FE·실제 DB/브라우저 CI와 증거 artifact |
| `docs/implementation/{IMPLEMENTATION-PLAN,QA-PLAN,PUBLIC-ROUND-VERIFICATION}.md` | 현재 실행 범위·증거·다음 작업 기준 |

정확한 변경 목록은 검증 대상 구현 커밋에 `git show --name-status <commit>`를 적용해 확인한다. 보호된 승인 파일 20개의 해시는 기존 기준과 동일하다.

## 실행 명령

요구 도구: Amazon Corretto 25, Docker Engine/Compose, Node 24.19.0·npm 11.17.0, Python 3.12 이상, Windows에서는 PowerShell 7. Gradle 9.8.1은 저장소 Wrapper로 받는다. 전역 Java 설정은 바꾸지 않는다.

```powershell
# 저장소 루트: 전체 검사 (Docker 필수, Chromium 설치 포함)
pwsh -NoProfile -File scripts/verify.ps1 -JavaHome 'C:\path\to\corretto-25' -Integration

# 빠른 계약/BE/FE 검사만 실행
pwsh -NoProfile -File scripts/verify.ps1 -JavaHome 'C:\path\to\corretto-25'

# 터미널 A: 개발 인프라와 백엔드
pwsh -NoProfile -File infra/up.ps1
pwsh -NoProfile -File scripts/run-backend.ps1 -JavaHome 'C:\path\to\corretto-25' -WithInfrastructure

# 터미널 B: 마이그레이션 완료 후 합성 데이터 입력
pwsh -NoProfile -File infra/seed-demo.ps1
Set-Location frontend
npm ci
npm run dev
# http://127.0.0.1:5173/?roundId=demo-round
```

일반 GET 예: `Invoke-RestMethod http://127.0.0.1:8080/api/v1/rounds/demo-round`. 중지할 때 각 앱을 종료하고 루트에서 `pwsh -NoProfile -File infra/stop.ps1`을 실행한다. 개발 DB 볼륨과 로컬 비밀번호는 보존한다.

개별 BE 검사: `backend`에서 Corretto 25 `JAVA_HOME`으로 `./gradlew.bat --no-daemon clean build integrationTest`. FE 검사는 `frontend`에서 `npm ci`, `npm test`, `npm run build`. `integrationTest`에 Docker가 없으면 실패하며 검사를 건너뛰어 PASS로 처리하지 않는다.

이식 가능한 통합 실행은 Python 환경에 `contracts/requirements-validation.txt`를 설치한 뒤 `python scripts/verify-integration.py --java-home <Corretto25> --install-browser`로 수행한다. 기본 동작은 양쪽 앱 빌드/검사부터 시작한다. `--skip-build`는 이미 검사한 JAR·FE dist와 설치된 npm 의존성을 사용하는 CI용 선택이다. Linux에서는 Playwright의 OS 의존성도 설치해야 한다(`frontend`에서 `npx playwright install --with-deps chromium`).

## 실제 검증 결과

| 종류 | 실행 결과와 관측 |
| --- | --- |
| 승인 기준·정적 | 승인 hash 20개, guard 반례 5개, 계약 정적 검사와 FE 생성 freshness 검사 |
| BE build/경계 | Corretto 25.0.3·Boot 4.1.1·Gradle 9.8.1. 기본 검사 10개: ArchUnit 3 + HTTP/보안 7 |
| BE 실제 DB | Testcontainers PostgreSQL 18.6 검사 7개. 빈 migration, 공개 여부, 404, 정확 ID/예약문자, 큰 counter/UTC, SQL 실패, 재기동 이력 |
| FE | Node 단위 검사 21개, TypeScript·production build·개발 fixture 제외 |
| 실제 HTTP 계약 | 정상 단계 5개 + 실제 DB 중단 단계 1개. 승인 OpenAPI 원본의 HTTP 상태별 JSON Schema·no-store·필드 값 확인 |
| 브라우저 | 정상 6개, DB 값 변경 1개, DB 중단 1개, DB 재시작 후 새 조회 1개. 총 9개, Chromium |
| 데이터/프로세스 | 빈 테이블 확인 → seed 2회에도 2행 → 앱 재시작 시 migration 이력 1건·2행 유지 → 시작 전 입찰 시간 10→15초·문자열 버전 증가 → DB 중단/복구 |
| 시각 검토 | desktop 1280px / mobile 390px PNG 실제 확인. 잘림·겹침 없고 서울 일정·미시작·4레인·시간 설정·큰 버전 표시 일치 |
| 정리 | 실행기가 만든 프로세스·컨테이너·임시 DB 볼륨만 종료/삭제. 개발 DB와 분리 |

로컬 전체 명령 `pwsh -NoProfile -File scripts/verify.ps1 -JavaHome 'C:\Users\jitin81\.jdks\corretto-25.0.3' -Integration`은 **PASS**다. 위 BE 17개·FE 21개·브라우저 9개에 실패/오류/건너뜀이 없고, 실제 HTTP 6개 및 모든 데이터/정리 검사가 통과했다. `.artifacts/public-round-final-verify.log`, `.artifacts/integration/20261016T100942-9b6d843a/summary.json`, 같은 폴더의 `http-up.json`/`http-down.json` 및 `output/playwright/round-query/20261016T100942-9b6d843a/`에 결과가 남는다. 이 로컬 실행은 위 분기 기준에 현재 변경을 적용한 커밋 전 작업 트리에서 수행했다. JAR SHA-256은 `3d66fd458b77576a114fdf7e7dc578a8e50f65376d947f1943d6c75ac2e18a8d`다.

원격 GitHub Actions는 구현 커밋 `39fb9e1`을 Ubuntu runner에 checkout해 계약 검사, Corretto 25의 `clean build integrationTest`, FE 설치/검사/빌드, 별도 PostgreSQL·Chromium 통합 실행을 모두 통과했다. 통합 job은 해당 실행의 BE JAR·FE dist artifact를 받아 사용한다. 원격 증거는 위 실행의 `contract-static-report`, `backend-test-reports`, `public-round-integration-evidence` artifact에서 확인한다. 문서 마감 커밋은 이 검증 대상의 애플리케이션·테스트·CI 코드를 변경하지 않는다.

문서의 개발 명령도 별도로 실행했다. `infra/up.ps1` → `scripts/run-backend.ps1 -WithInfrastructure`에서 기존 전용 개발 DB에 V1이 처음 적용되고 앱이 기동했다. `infra/seed-demo.ps1`의 첫 실행은 2행, 두 번째 실행은 0행 추가였으며 실제 HTTP `up` 5/5가 PASS다(`.artifacts/public-round-dev-http.json`). 이후 이번 앱 프로세스와 개발 서비스만 중지했고 DB 볼륨·로컬 비밀번호·합성 2행은 보존했다.

중간 실패도 구별한다. Testcontainers는 digest가 붙은 공식 postgres 이미지의 호환 이름을 명시해야 했고, 첫 초기화 실패 후 해당 선언을 추가해 실제 검사를 수행했다. 첫 브라우저 변경 검사는 실행 도중 fixture를 승인 규칙에 맞게 수정하면서 구 실행기의 레인 변경과 새 기대값이 불일치했다. 이후 입력과 검사를 일치시켰다. 복구 검사에서는 Docker가 재시작 시 자동 할당 포트를 바꾸는 현상을 확인해 생성 시 선택한 임시 포트를 실행 동안 고정했다. 각 실패 실행의 cleanup은 성공했고 최종 검사는 수정본에서 다시 실행했다.

## 의존성과 선택 이유

| 추가 의존성 | 이유·범위 |
| --- | --- |
| `spring-boot-starter-flyway` / `flyway-database-postgresql` (Flyway 12.4.0) | PostgreSQL 스키마 이력을 재현하고 변경을 순서대로 적용. Boot 4.1.1 BOM + Gradle lock 사용 |
| `testcontainers-junit-jupiter` / `testcontainers-postgresql` (2.0.5) | H2 대체 없이 실제 PostgreSQL과 Flyway·정확한 ID·numeric·timestamptz 검증. test scope, Boot BOM + lock |
| `@playwright/test` 1.64.1 | 실제 API 화면·모바일 viewport·DB 장애·trace/screenshot 자동 검사. dev dependency, npm lock |

JPA·별도 라우터·전역 상태 관리·추가 모킹 프레임워크는 현재 흐름에 필요하지 않아 추가하지 않았다. Flyway 구성은 [Boot 공식 데이터 초기화 안내](https://docs.spring.io/spring-boot/how-to/data-initialization.html), PostgreSQL 시험은 [Testcontainers 공식 모듈](https://java.testcontainers.org/modules/databases/postgres/)을 따른다.

## 제약과 다음 구현 전 필요한 사항

- Windows 로컬과 GitHub Actions Ubuntu의 구체 실행 결과를 구별한다. 최초 의존성/브라우저/이미지 다운로드에는 네트워크가 필요하다. 실제 사용자 PC 전체·macOS는 별도 검증 대상이다.
- Chromium과 두 viewport만 확인했다. OPEN-08의 전체 지원 브라우저 인수, 전체 접근성·성능 인수는 NOT_RUN이다.
- DB 복구는 같은 백엔드를 유지한 상태에서 DB를 재시작한 뒤 **새 브라우저 조회**가 성공한 증거다. 기존 503 화면에서 성공 재시도, 경매 장애 정합성, 서비스 admission, lease·commit 불명·SSE 복구를 검증한 것이 아니다.
- 이번 저장 구조는 회차 생성/공개/시작 명령과 타이머를 구현하지 않는다. 다음 변경은 auction 소유 쓰기 유스케이스, 승인된 트랜잭션/버전 규칙과 다음 Flyway 버전으로 확장한다. 예제 데이터가 승인 경매 자동 진행을 대신하지 않는다.
- 다음 담당자는 `AGENTS.md`, 최신 구현/QA 계획, 승인 계약과 자신이 맡는 카드의 OPEN을 확인한다. 인증·세션 구현은 해당 정책 결정 이후 진행하고 공용 security/config/migration 변경 담당을 하나로 지정한다.
- 입찰·동시성·공식 접수 순서·SSE·실제 인증·메일/사진·백업/복원·운영 배포는 NOT_RUN이다. CI 성공은 브랜치 보호나 운영 승인 적용의 증거가 아니다.
