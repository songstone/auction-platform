# Backend 개발 골격

승인된 [SYSTEM-DESIGN 1.0](../docs/architecture/SYSTEM-DESIGN.md)과 [공통 계약 0.1.0](../contracts/README.md)을 구현하는 단일 Gradle 앱이다. 현재 업무 흐름은 **공개 회차 목록 `GET /api/v1/rounds` 및 상세 `GET /api/v1/rounds/{roundId}` → PostgreSQL 읽기 전용 projection**이다. Actuator 요약 health·공통 오류·요청 추적·마이그레이션과 패키지 경계 검사를 제공한다. 계정·출품·입찰·원판정·ACK·SSE·업무 진행 복구·진행 권한은 구현하지 않았다. 공개 조회의 DB 단절/복귀 증거는 [M-01 실행 기록](../docs/implementation/ROUND-DISCOVERY-VERIFICATION.md)에 있다.

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

## Docker와 함께 로컬 실행

Docker Desktop을 실행하고 PowerShell 7의 `pwsh`가 PATH에서 실행되는지 확인한다. 백엔드 디렉터리에서 다음 명령을 실행하면 현재 소스 컴파일, 개발용 PostgreSQL·Mailpit 기동과 준비 확인, DB 연결을 함께 수행한다. 별도 JAR 빌드나 DB 비밀번호 입력은 필요하지 않다.

```powershell
# backend/에서 실행. JAVA_HOME은 Amazon Corretto 25를 가리켜야 한다.
.\gradlew.bat --no-daemon bootRunLocal
```

`bootRunLocal`은 `prepareLocalInfrastructure`를 통해 루트의 `infra/up.ps1`을 실행한다. 기본 앱 주소는 `http://127.0.0.1:8080`, DB 이름/사용자는 `auction`이다. 최초 실행에서 `infra/.runtime/db-password`를 생성하고 이후 같은 비밀번호와 데이터 볼륨을 재사용한다. Compose에 실제 배정된 포트와 비밀번호는 앱 프로세스 환경으로 전달한다. `infra/.env`의 포트 변경도 앱 연결에 반영한다. 앱을 종료해도 개발 인프라는 유지되며 저장소 루트에서 `pwsh -NoProfile -File infra/stop.ps1`로 중지한다.

IntelliJ에서는 다음과 같이 실행한다.

1. 저장소 루트를 열고 `backend/build.gradle.kts`를 Gradle 프로젝트로 연결한다.
2. Gradle JVM을 **Amazon Corretto 25**로 설정한다.
3. 공유 실행 구성 **`Backend (local Docker)`**를 선택해 실행한다. 이 구성은 `bootRunLocal` 작업을 사용한다.

main 클래스 옆 실행 버튼으로 새로 만든 Application/Spring Boot 구성은 위 Gradle 준비 작업을 실행하지 않는다. IDE 동기화와 일반 `build`·`test`도 개발 Compose를 기동하지 않는다. IDE 실행 화면·디버깅의 실제 검증 여부는 [로컬 Docker 연동 검증](../docs/implementation/LOCAL-BACKEND-COMPOSE-VERIFICATION.md)에 구분한다.

이미 빌드한 JAR을 실행하려면 저장소 루트에서 `pwsh -NoProfile -File scripts/run-backend.ps1 -JavaHome 'C:\path\to\jdk-25' -WithInfrastructure`를 사용한다. 이 명령도 Compose를 준비하고 연결하지만 현재 소스를 빌드하지 않으므로 먼저 `clean build` 또는 `scripts/verify.ps1`을 실행한다. 개발용 예제 회차는 앱 기동 후 [명시적 seed](../infra/README.md#공개-회차-개발-데이터)를 별도로 실행해야 한다.

## 외부 서비스 없는 기본 실행

```powershell
& "$env:JAVA_HOME\bin\java.exe" -jar build/libs/auction-platform-backend-0.1.0-SNAPSHOT.jar
```

기본 주소는 `127.0.0.1:8080`이며 `SERVER_ADDRESS`·`SERVER_PORT`로 바꿀 수 있다. `GET /actuator/health`는 상태 요약을 제공한다. 기본 프로필의 공개 회차 조회는 DB를 사용하지 않고 `503 SERVICE_UNAVAILABLE`로 명확히 응답한다. details·components·env/configprops 등 관리 정보는 공개하지 않는다. 자동 생성 기본 계정·HTTP Basic·로그인 폼을 설치하지 않는다. CSRF와 기본 보안 응답 헤더는 유지한다.

health의 `UP`은 프로세스와 활성 health indicator의 요약 상태다. 정상 입찰 접수, authority 확보, 메일/사진 연계, 업무 readiness를 증명하지 않는다. 공개 조회 외 경로의 403은 해당 API 구현 완료·인수 PASS가 아니다. 보안 차단은 실제 인증·세션 계약 구현 때 승인된 공개/개인 경계로 교체한다.

기본 profile은 DataSource auto-configuration과 Flyway를 명시적으로 끈다. 기본 실행은 DB에 연결하거나 테이블을 만들지 않는다.

## 준비된 로컬 인프라 연결

[.env.example](.env.example)은 직접 실행 시 필요한 변수 안내이며 Spring Boot가 자동으로 읽는 파일이 아니다. `bootRunLocal` 또는 `run-backend.ps1 -WithInfrastructure`로 전용 개발 Compose를 사용할 때는 아래 값을 자동 주입하므로 비밀번호를 수동 설정하지 않는다.

| 환경 | 준비 값 / 실제 연결 상태 |
| --- | --- |
| `SPRING_PROFILES_ACTIVE=local-infra` | 실제 DataSource·Flyway·JDBC 공개 회차 adapter 활성화 |
| `DB_URL` | 기본 `jdbc:postgresql://127.0.0.1:55432/auction`. 로컬 실행기는 Compose의 실제 포트를 반영 |
| `DB_USER` | 개발 Compose 사용자 `auction` |
| `DB_PASSWORD` | **필수 런타임 비밀**. 로컬 실행기가 보존된 secret에서 주입. 예제·로그·명령 인수에 값을 넣지 않음 |
| `DB_CONNECTION_TIMEOUT_MS` / `DB_VALIDATION_TIMEOUT_MS` | local-infra Hikari 연결/검증 timeout. 생략 시 30000/5000ms. 시험에서만 단축 가능하며 제품 응답시간 보장이 아님 |
| `MAIL_HOST` / `MAIL_PORT` | 기본 `127.0.0.1` / `51025`. 로컬 실행기는 Compose의 실제 SMTP 포트를 반영. 메일 adapter·메일 발송은 미구현 |
| `PHOTO_ROOT` | 루트 실행기가 `infra/.runtime/photos`의 절대 경로를 전달할 준비 입력. 파일 adapter·업로드는 미구현 |

루트 인프라 도구는 자체 생성 비밀을 `infra/.runtime/db-password`에서 관리한다. 이 앱은 그 파일을 직접 읽지 않는다. `infra/.runtime/backend.properties`에는 비밀번호를 제외한 연결 정보만 기록한다. `bootRunLocal`과 [run-backend.ps1](../scripts/run-backend.ps1)의 `-WithInfrastructure` 옵션은 이 정보와 secret을 읽어 전용 개발 Compose의 환경으로 주입하며 기존 `DB_URL`·`DB_USER`·`DB_PASSWORD` 값보다 우선한다. 외부 DB를 직접 연결하려면 이 자동 준비 경로를 사용하지 않고 `local-infra` 프로필과 해당 DB 환경변수를 별도로 설정한다. 실제 인프라 준비·실행 명령은 [infra 안내](../infra/README.md)를 따른다.

관리되는 로컬 실행은 `SPRING_DATASOURCE_URL/USERNAME/PASSWORD`와 `SPRING_FLYWAY_URL/USER/PASSWORD`도 같은 개발 DB 값으로 덮어쓴다. 실행 구성에 별도 DB 관련 JVM 옵션·Spring JSON 설정·명령 인수는 추가하지 않는다.

`local-infra`에서 `${DB_PASSWORD}`가 해석되지 않으면 시작을 계속하지 않는다. Flyway 실패도 시작 실패다. 이력 테이블은 `public.flyway_schema_history`에 고정한다. DB 사용자와 업무 스키마가 모두 `auction`인 경우 재기동 때 PostgreSQL의 기본 검색 스키마가 달라져도 기존 이력을 계속 사용하기 위한 설정이다. 임의 `schema.sql`/`data.sql` 자동 초기화는 `never`이며 마이그레이션에 개발 fixture를 넣지 않는다. 이 profile의 DB health가 성공해도 경매 업무 트랜잭션·승인 조건을 검증한 것은 아니다.

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
