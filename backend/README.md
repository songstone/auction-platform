# Backend 개발 골격

승인된 [SYSTEM-DESIGN 1.1](../docs/architecture/SYSTEM-DESIGN.md)과 [공통 계약 0.1.0](../contracts/README.md)을 구현하는 단일 Gradle 앱이다. 현재 업무 흐름은 **공개 회차 목록 `GET /api/v1/rounds` 및 상세 `GET /api/v1/rounds/{roundId}` → PostgreSQL 읽기 전용 projection**이다. Actuator 요약 health·공통 오류·요청 추적·마이그레이션과 패키지 경계 검사를 제공한다. D-096의 JPA 업무 엔티티·Spring Data Repository 적용은 [전환 계획](../docs/implementation/JPA-ADOPTION-PLAN.md)을 따르며 아직 의존성·DDL·업무 저장 경로를 전환하지 않았다. 계정·출품·입찰·원판정·ACK·SSE·업무 진행 복구·진행 권한은 구현하지 않았다. 공개 조회의 DB 단절/복귀 증거는 [M-01 실행 기록](../docs/implementation/ROUND-DISCOVERY-VERIFICATION.md)에 있다.

## 고정 도구

| 도구 | 버전 / 이유 |
| --- | --- |
| Java 실행·컴파일 | **Amazon Corretto 25**. Gradle의 Java toolchain과 release 25 설정. 현재 로컬 기준은 Corretto **25.0.3** |
| Spring Boot | **4.1.1**, MVC·JDBC 기반. [공식 요구사항](https://docs.spring.io/spring-boot/4.1/system-requirements.html)의 Java 17~26 및 Gradle 9.x 지원 범위에 맞춘 구성 |
| Gradle | **9.8.1**, [Wrapper 설정](gradle/wrapper/gradle-wrapper.properties)의 배포 버전·SHA-256으로 고정. Kotlin DSL 사용 |
| ArchUnit | **1.5.1**, [공식 GA 릴리스](https://github.com/TNG/ArchUnit/releases/tag/v1.5.1) |

JDK 25에서 Gradle을 실행하는 공식 지원은 [Gradle 9.1.0부터](https://docs.gradle.org/9.1.0/release-notes.html#support-for-java-25)다. Spring Boot 4.1.1은 Gradle 8.14 이상의 8.x와 9.x를 지원하므로 현재 Corretto 25·Gradle 9.8.1 조합은 이 지원 범위에 포함된다. 공식 호환 범위와 이 저장소의 실제 빌드·테스트·패키징 JAR 관측은 구분하며, 실행 결과와 미실행 범위는 [Spring Boot 4 전환 검증 기록](../docs/implementation/BOOT4-MIGRATION-VERIFICATION.md)을 따른다. [Spring Boot 요구사항](https://docs.spring.io/spring-boot/4.1/system-requirements.html), [Gradle 호환성](https://docs.gradle.org/9.8.1/userguide/compatibility.html)

현재 빌드 선언의 원본은 [build.gradle.kts](build.gradle.kts), 해석한 프로젝트 의존성의 잠금 원본은 [gradle.lockfile](gradle.lockfile)이다. Boot의 BOM을 Gradle native enforced platform으로 적용하며 별도 dependency-management plugin은 사용하지 않는다. Wrapper 파일·배포 다운로드·캐시 재사용의 검증 범위도 새 실행 기록을 따른다. 제품 스택의 보안·운영 적합성 및 전체 기능 검증은 별도다. 실험 코드·fixture·DB를 제품 코드에 복사하지 않았다.

## 빌드

Amazon Corretto 25를 설치하고 `JAVA_HOME`을 해당 디렉터리로 지정한다. 시스템 PATH가 구형 Java를 가리키는 경우에도 Wrapper가 사용할 `JAVA_HOME`부터 확인한다.

```powershell
# backend/에서 실행. 실제 Corretto 25 설치 위치를 사용한다.
$env:JAVA_HOME = 'C:\path\to\jdk-25'
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
.\gradlew.bat --version
.\gradlew.bat --no-daemon clean build
```

macOS/Linux는 같은 JDK 기준에서 `bash ./gradlew --no-daemon clean build`를 사용한다. 처음 실행할 때 고정한 Gradle 배포물과 의존성을 다운로드하므로 네트워크가 필요하다. 시스템 Gradle 대신 저장소의 Wrapper를 사용하며, `JAVA_HOME`의 JDK 25가 실행·컴파일에 사용되는지 `--version`과 빌드 결과에서 확인한다.

실행 JAR은 `build/libs/auction-platform-backend-0.1.0-SNAPSHOT.jar`다. 테스트 XML은 `build/test-results/test/`, HTML 보고서는 `build/reports/tests/test/index.html`에 생성한다. 애플리케이션 버전은 개발 artifact 식별이며 제품 기능 완료나 계약 버전 변경을 뜻하지 않는다.

실제 PostgreSQL 검증은 별도 명령이다. Docker가 필요하며, 없으면 실패한다. `build`는 `integration` 태그를 제외하므로 이 명령을 실행하지 않고 DB 시험 PASS로 보고하지 않는다.

```powershell
.\gradlew.bat --no-daemon integrationTest
```

Testcontainers는 Compose 개발 DB와 다른 임시 PostgreSQL 18.6 컨테이너를 생성한다. 고정한 이미지 digest는 개발 인프라와 같다. 시험 종료 때 컨테이너를 정리하며 시험 중 초기화는 이 임시 DB에만 수행한다. 결과는 `build/test-results/integrationTest/`와 `build/reports/tests/integrationTest/index.html`이다. Testcontainers 2.x의 PostgreSQL/JUnit 모듈은 Boot BOM으로 관리하고 정확 버전을 lockfile에 고정한다. [공식 PostgreSQL 모듈](https://java.testcontainers.org/modules/databases/postgres/)

## 로컬 실행

Docker Desktop을 켜고, 최초 한 번 [.env.example](.env.example)을 `.env`로 복사하여 `POSTGRES_PASSWORD`에 로컬 DB 비밀번호를 지정한다. 기존 `.env`가 있으면 그대로 사용한다. `.env`는 Git에서 제외하며 기존 PostgreSQL 볼륨을 계속 쓸 때는 비밀번호를 유지한다.

```powershell
# backend/에서 실행
$env:JAVA_HOME = 'C:\path\to\jdk-25'
.\gradlew.bat bootRun --args='--spring.profiles.active=local-infra'
```

[build.gradle.kts](build.gradle.kts)의 `developmentOnly("org.springframework.boot:spring-boot-docker-compose")`가 [compose.yaml](compose.yaml)을 읽어 PostgreSQL·Mailpit을 기동한다. JDBC 주소·사용자·비밀번호는 Spring Boot의 서비스 연결로 자동 적용되므로 `DB_PASSWORD`를 따로 설정할 필요가 없다. `.env`는 Docker Compose가 읽는다. [Spring Boot 공식 안내](https://docs.spring.io/spring-boot/reference/features/dev-services.html)

IntelliJ에서는 Gradle을 동기화한 뒤 `AuctionPlatformApplication`을 실행한다. JDK는 **Corretto 25**, 활성 프로필은 **`local-infra`**, working directory는 **`backend` 절대 경로**로 지정한다. 일반 Application 설정에는 프로그램 인수 `--spring.profiles.active=local-infra`를 사용한다.

| 서비스 | 기본 주소 |
| --- | --- |
| 백엔드 | `http://localhost:8080` |
| PostgreSQL | `127.0.0.1:55432`, DB·사용자 `auction` |
| Mailpit UI / SMTP | `http://127.0.0.1:58025` / `127.0.0.1:51025` |

포트는 `.env`의 `AUCTION_DB_PORT`, `AUCTION_MAIL_UI_PORT`, `AUCTION_MAIL_SMTP_PORT`로 바꿀 수 있다. 백엔드 종료 뒤에도 서비스는 유지되며, `backend`에서 `docker compose stop`으로 중지한다. DB 볼륨은 보존된다. Mailpit은 개발 수신기이며 제품 메일 adapter는 아직 없다.

Flyway가 빈 업무 테이블을 준비한다. 예제 회차는 저장소 루트에서 `pwsh -NoProfile -File infra/seed-demo.ps1`로 별도 추가한다. 현재 연동의 검증 범위는 [로컬 Compose 실행 기록](../docs/implementation/NATIVE-COMPOSE-VERIFICATION.md)을 따른다.

## 외부 서비스 없는 기본 실행

```powershell
& "$env:JAVA_HOME\bin\java.exe" -jar build/libs/auction-platform-backend-0.1.0-SNAPSHOT.jar
```

기본 주소는 `127.0.0.1:8080`이며 `SERVER_ADDRESS`·`SERVER_PORT`로 바꿀 수 있다. `GET /actuator/health`는 상태 요약을 제공한다. 기본 프로필의 공개 회차 조회는 DB를 사용하지 않고 `503 SERVICE_UNAVAILABLE`로 명확히 응답한다. details·components·env/configprops 등 관리 정보는 공개하지 않는다. 자동 생성 기본 계정·HTTP Basic·로그인 폼을 설치하지 않는다. CSRF와 기본 보안 응답 헤더는 유지한다.

health의 `UP`은 프로세스와 활성 health indicator의 요약 상태다. 정상 입찰 접수, authority 확보, 메일/사진 연계, 업무 readiness를 증명하지 않는다. 공개 조회 외 경로의 403은 해당 API 구현 완료·인수 PASS가 아니다. 보안 차단은 실제 인증·세션 계약 구현 때 승인된 공개/개인 경계로 교체한다.

기본 profile은 DataSource auto-configuration과 Flyway를 명시적으로 끈다. 기본 실행은 DB에 연결하거나 테이블을 만들지 않는다.

패키징 JAR에는 개발용 Compose 모듈이 포함되지 않는다. JAR을 실제 DB에 직접 연결할 때는 실행 환경에 `SPRING_PROFILES_ACTIVE=local-infra`, `DB_URL`, `DB_USER`, `DB_PASSWORD`를 제공한다. 이 경우 DB는 별도로 준비하고 비밀번호는 명령 인수나 로그에 넣지 않는다. Flyway 실패는 시작 실패이며 `schema.sql`/`data.sql` 자동 초기화는 사용하지 않는다.

## 저장·조회·오류 경계

[V1 migration](src/main/resources/db/migration/V1__create_auction_round.sql)이 `auction.rounds`를 만든다. 테이블 소유 기능은 `auction`이며 query는 명시된 SELECT projection만 사용한다. Flyway 이력은 `public.flyway_schema_history`다. 적용된 migration을 수정하지 않고 다음 버전으로 변경하며 `clean`은 비활성화한다. 개발 데이터는 루트의 명시적 fixture 도구로만 넣는다.

목록과 상세는 같은 predicate로 `published_at IS NOT NULL`인 허용 공개 상태만 반환한다. 목록은 `scheduled_starts_at`, `round_id`(C collation) 순서의 keyset이며 내부 20행 단위와 lookahead를 사용한다. cursor는 opaque 목록 전용 값으로 전달하고 마지막은 null이다. 잘못된/다른 scope cursor는 400이며 고정 snapshot·제품 총수 상한을 추가하지 않는다. 예약 공개 시각이 지났다는 이유로 공개를 추정하지 않는다. 존재하지 않는 ID와 미공개 ID는 같은 `404 RESOURCE_NOT_FOUND`다. ID는 대소문자와 앞뒤 공백을 보존하고 공백만이면 `400 VALIDATION_FAILED`다. 카운터는 DB numeric의 정수값을 10진 문자열로 반환하고 시각은 PostgreSQL의 마이크로초를 보존한 UTC `Z` 문자열이다. 아직 회차 생성·공개·진행 상태를 바꾸는 유스케이스나 worker는 없다.

URL의 ID는 한 경로 segment로 percent encoding한다. Tomcat은 encoded slash를 분리자로 디코딩하지 않고 통과시킨다. `PublicRoundHttpFirewall`은 정확한 GET `/api/v1/rounds/<한 raw segment>`에서만 encoded slash/percent를 허용하고 다른 경로·메서드는 기존 strict 검사를 적용한다. 헤더·정규화·기타 공격성 경로 검사는 유지한다. Spring의 segment 디코딩 뒤 ID를 SQL 매개변수로 한 번만 전달하며 추가 URL decoding은 하지 않는다.

API 성공·오류는 `Cache-Control: no-store`를 사용한다. 공통 오류는 계약의 `code/message/traceId/serverTime/fieldErrors` 다섯 필드이며 조회 DB 오류는 `503 SERVICE_UNAVAILABLE`다. 미구현 경로는 `403 ROLE_REQUIRED`, CSRF 없는 변경 요청은 `403 CSRF_INVALID`다. 인증을 완료했다는 의미는 아니며 실제 로그인·세션 수명 정책은 후속 작업이다.

요청별 서버 생성 `X-Trace-Id`를 응답과 오류·요약 로그에 연결한다. 요청 raw URI·query·본문·인증 헤더·쿠키·SQL·예외 메시지를 공통 로그/오류에 기록하지 않는다. 기본 기록은 trace ID, HTTP status, 처리시간과 고정 오류 코드다. 외부 trace ID는 신뢰하거나 재사용하지 않는다.

## 패키지와 검사

[MODULE-BOUNDARIES.md](MODULE-BOUNDARIES.md)는 코드 위치·검사 연결을 설명한다. 책임의 공식 원본은 시스템 설계이고 정책·계약 원본은 수정하지 않는다.

- `ArchitectureRulesTest`: 실제 production bytecode의 계층·기능 의존성/순환 검사와 의도적 위반 fixture를 사용한 guard 확인.
- `InfrastructureBoundaryTest`: DB 없는 기본 컨텍스트·요약 health·미구현 경로 차단·기본 계정 부재·503/400/CSRF 오류 확인.
- `PublicRoundPostgresIntegrationTest`: 빈 PostgreSQL에 Flyway 적용, 공개/미공개/없는 ID, 정확 ID·큰 카운터·마이크로초·SQL 실패, 재기동 시 데이터/마이그레이션 이력 보존. 공개 목록 필터·동률 정렬·복수/끝 페이지·cursor 경계·DB down/up 및 읽기 무변경도 포함.

빈 기능 패키지의 경계는 앞으로 추가되는 코드에 적용할 검사다. 음성/양성 fixture 검사가 경계 규칙의 작동을 확인해도 실제 경매 구현의 정합성·완전한 모듈 구현을 입증하지 않는다. 현재 M-01 실행 결과는 [공개 회차 탐색 검증](../docs/implementation/ROUND-DISCOVERY-VERIFICATION.md)을 따른다. Corretto 25·Spring Boot 4.1.1·Gradle 9.8.1 전환 당시 결과는 [Spring Boot 4 전환 검증 기록](../docs/implementation/BOOT4-MIGRATION-VERIFICATION.md)에 보존한다.

초기 Maven 골격의 실제 명령·산출물·검증 범위는 [2026-10-16 백엔드 실행 이력](verification/2026-10-16-scaffold.md)과 [초기 통합 실행 이력](../docs/implementation/FOUNDATION-VERIFICATION.md)에 보존한다. Spring Boot 3.5.16에서 수행한 빌드 도구 전환은 [Gradle 전환 실행 이력](../docs/implementation/GRADLE-MIGRATION-VERIFICATION.md)에 보존한다. 각 기록은 당시 버전의 실행 사실이며 현재 Spring Boot 4 실행 결과로 치환하지 않는다.
