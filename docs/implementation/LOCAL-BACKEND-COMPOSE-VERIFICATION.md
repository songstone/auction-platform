# 로컬 백엔드와 Docker Compose 연결 검증 — 2026-10-16

## 변경과 대상

검증한 구현 커밋은 `94b5c435a475755d3ce8e23e4bfcc231f3b0cfd2`이며 작업 브랜치는 `chore/local-backend-compose`다. 시작점은 `origin/dev`의 `707f026551d273a9eeeee8e7f2303649ef122c41`이다. 실행 안내와 이 보고서는 구현 검증 후 별도 문서 커밋으로 추가한다. 승인 제품·설계·계약·마이그레이션 원본은 변경하지 않았다.

- `bootRunLocal`은 현재 소스를 컴파일하고 `infra/up.ps1`로 전용 개발 Compose를 기동한 뒤 앱을 실행한다. IntelliJ 공유 `Backend (local Docker)` 구성도 같은 Gradle 작업을 지정한다.
- `up.ps1`은 실제 DB·SMTP 매핑 포트를 조회해 비밀 없는 `infra/.runtime/backend.properties`에 기록한다. 두 실행기는 기존 `db-password`를 메모리에서 읽어 앱 환경에 전달한다. 비밀번호를 새 설정 파일·명령 인수에 복제하지 않는다.
- 기존 JAR 실행기의 `-WithInfrastructure`도 Compose를 자동 준비한다. 관리되는 로컬 실행은 기존 `DB_*` 및 직접 지정한 datasource/Flyway 접속 환경변수보다 전용 Compose 접속값을 우선한다.
- Flyway 이력 스키마를 `public`으로 고정했다. 실제 개발 DB 사용자 `auction`과 업무 스키마 `auction`이 일치할 때도 재시작 시 기존 이력을 찾는다. 기존 migration SQL과 DB 데이터는 수정하지 않았다.

Gradle `BootRun`의 실행 방식과 IntelliJ Gradle 실행 구성은 [Spring Boot 문서](https://docs.spring.io/spring-boot/gradle-plugin/running.html), [IntelliJ 문서](https://www.jetbrains.com/help/idea/run-debug-gradle.html)를 참고했다. IDE 화면 조작 및 디버거 검증과는 구분한다.

## 실행 명령과 증거

Windows / PowerShell 7 / Amazon Corretto 25.0.3 / Gradle Wrapper 9.8.1 / Spring Boot 4.1.1 / Docker Engine 28.5.1에서 실행했다. 증거 위치는 Git에서 제외한 `.artifacts/local-backend-compose/`다.

```powershell
python scripts/check-approved-baseline.py --strict-evidence
pwsh -NoProfile -File scripts/verify.ps1 -JavaHome C:/Users/jitin81/.jdks/corretto-25.0.3
$env:JAVA_HOME = 'C:/Users/jitin81/.jdks/corretto-25.0.3'
.\backend\gradlew.bat -p backend --no-daemon --console=plain clean build integrationTest
python -X utf8 .artifacts/local-backend-compose/verify-local.py
git diff --check
```

| 종류 | 실제 결과 | 증거 |
| --- | --- | --- |
| 승인 기준선 | 20개 파일 strict integrity PASS | 명령 출력. 정책·런타임 통과 의미 없음 |
| fast 검사 | 계약·guard·BE·FE 검사 PASS. Flyway 수정 전 1회 실행 | `fast.log`; 최종 BE 변경은 아래 clean 검증으로 재실행 |
| 최종 BE clean 검사 | 단위/아키텍처 13개 + 실제 PostgreSQL 15개, 실패·skip 0 | `backend-final.log`, `test-summary.json`, `backend/build/test-results/{test,integrationTest}` |
| DB 재시작 회귀 | 임시 DB 사용자도 `auction`으로 맞춰 최초 migration·두 번째 앱 기동·데이터/이력 보존 확인 | `PublicRoundPostgresIntegrationTest.freshDatabaseMigrationAndApplicationRestartPreserveData` |
| Compose 중지 → Gradle 기동 | 자동 기동 후 health 200, 공개 목록 200 및 no-store | `gradle-stopped-start.log`, `runtime-summary.json` |
| JAR 실행 + 포트 변경 | `AUCTION_DB_PORT`·`AUCTION_MAIL_SMTP_PORT` 변경 후 실제 매핑값으로 앱 연결 | `packaged-custom-port.log`, `runtime-summary.json` |
| 기존 환경값 충돌 | 잘못된 `DB_*`, `SPRING_DATASOURCE_*`, `SPRING_FLYWAY_*` 접속값을 주입해도 전용 개발 DB 연결 | 위 두 실행 로그 및 검증 실행기 |
| Docker 접근 실패 | 접근 불가능한 `DOCKER_HOST` 주입 시 exit 1, 앱 기동 전 실패 | `docker-unavailable.log` |
| 데이터·비밀·정리 | 회차 행 fingerprint·Flyway 이력 수·기존 password 내용 보존, 로그의 해당 비밀번호 검출 0. 시험 앱 프로세스 종료 후 개발 Compose 기본 포트 복원 | `runtime-summary.json`, `restore.log` |
| IntelliJ 구성 | 공유 XML 파싱 PASS 및 작업명 대조. IDE 실행·Debug는 NOT_RUN | `.run/Backend local Docker.run.xml` |

로컬 smoke 실행기는 개발 DB에 SELECT만 수행했다. 별도 seed·TRUNCATE·볼륨 삭제는 하지 않았다. 앱 기동의 Flyway는 기존 이력을 검증하고 추가 migration 없이 종료했다. PostgreSQL 통합 테스트의 fixture 조작은 Testcontainers가 만든 임시 DB에만 수행했다. 실행기와 로그는 현재 환경의 관측 증거이며 새 checkout의 필수 도구는 아니다. 재현 진입점은 [백엔드 안내](../../backend/README.md)다.

## 발견한 실패와 수정

첫 실제 기동은 DB 연결 후 Flyway의 `Found non-empty schema(s) "auction" but no schema history table`로 실패했다. PostgreSQL 기본 `search_path`는 `"$user", public`이고 기존 이력은 `public.flyway_schema_history`에 있었다. 첫 migration이 `auction` 스키마를 만든 뒤 다음 연결의 기본 스키마가 바뀌는 사례였다. `spring.flyway.default-schema: public`과 동일 사용자 회귀 조건으로 수정했다. `baselineOnMigrate`나 기존 migration 재작성으로 우회하지 않았다. 최초 로그는 `first-flyway-failure.log`에 보존했다.

중간 `build integrationTest` 실행은 `integrationTest NO-SOURCE`여서 DB 통과 증거로 사용하지 않았다. 이후 명시적 integrationTest 실행과 최종 `clean build integrationTest`에서 테스트 XML 15개 실행·skip 0을 확인했다. 최종 증거는 위 `backend-final.log`와 `test-summary.json`이다.

## CI·통합과 미실행 범위

구현 CI는 [38863720499](https://github.com/songstone/auction-platform/actions/runs/38863720499)다. 문서 포함 최종 커밋의 필수 CI를 확인한 뒤 최신 `dev`로 통합한다. 최종 SHA·CI 결과·원격 포함 관계·작업 브랜치 정리 결과는 `.artifacts/local-backend-compose/final-handoff.json`과 사용자 인계에 기록한다. 이 보고서 작성 시점에 아직 끝나지 않은 통합을 미리 성공으로 기록하지 않는다.

로컬 브라우저·IntelliJ UI/Debug·메일 발송·사진 저장은 NOT_RUN이다. 원격 CI의 브라우저 결과는 해당 CI 실행 범위로만 보고한다. 인증 세션·출품·입찰·SSE·업무 장애 복구·성능·운영 준비를 이번 실행으로 검증하지 않았다. 현재 변경은 로컬 개발 실행과 Flyway 재기동 오류 수정이다.
