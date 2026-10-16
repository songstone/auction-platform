# Spring Boot 4 전환 검증 — 2026-10-16

## 적용 범위와 검증 대상

사용자가 승인한 Amazon Corretto 25 + Spring Boot 4.1.1 + Gradle 9.8.1 조합을 적용했다. 이번 변경은 기존 개발 골격의 Boot 전환이며, 공개 조회·인증·migration·입찰·SSE 구현은 후속 작업이다.

- 이전 기준 커밋: `09db7dba7770dc738ca5ee234b4c060fdc80999e`
- 검증한 코드 커밋: `5f968ce6c27c6a8a4a9aa3d5d965e52bad2e01b8`
- 로컬 빌드·시험·JAR 실행 후 같은 소스와 lockfile을 위 커밋으로 기록했다. 커밋 후 해당 경로의 `git diff --exit-code HEAD`가 성공했다.
- 초기 Maven 실행과 Boot 3.5.16의 Gradle 전환 결과는 각각 [FOUNDATION-VERIFICATION](FOUNDATION-VERIFICATION.md)·[GRADLE-MIGRATION-VERIFICATION](GRADLE-MIGRATION-VERIFICATION.md)에 보존했다.

## 변경 파일과 이유

| 파일 | 변경·이유 |
| --- | --- |
| [backend/build.gradle.kts](../../backend/build.gradle.kts) | Boot plugin/BOM 4.1.1, `spring-boot-starter-webmvc`, Corretto 컴파일·테스트를 위한 `JvmVendorSpec.AMAZON` 지정 |
| [backend/gradle.lockfile](../../backend/gradle.lockfile) | Boot 4.1.1 BOM으로 실제 해석한 프로젝트 의존성 재고정 |
| [AuctionPlatformApplication.java](../../backend/src/main/java/com/auctionplatform/bootstrap/AuctionPlatformApplication.java) | 기본 계정 생성을 막는 `UserDetailsServiceAutoConfiguration`의 새 패키지 반영 |
| [application.yaml](../../backend/src/main/resources/application.yaml) | `DataSourceAutoConfiguration` 새 패키지, `spring.web.error` 접두사, 요약 health를 유지하는 `probes.enabled=false` |
| [InfrastructureBoundaryTest.java](../../backend/src/test/java/com/auctionplatform/bootstrap/InfrastructureBoundaryTest.java) | TestRestTemplate 패키지 이동·명시적 자동 설정, liveness/readiness 하위 경로 차단 검사 |
| [루트 README](../../README.md), [backend README](../../backend/README.md), [IMPLEMENTATION-PLAN](IMPLEMENTATION-PLAN.md), [QA-PLAN](QA-PLAN.md) | 현재 조합·실행 안내·검증 원본 연결 갱신 |

TestRestTemplate의 기존 실제 HTTP 시험을 유지하기 위해 `spring-boot-resttestclient`를 `testImplementation`, `spring-boot-restclient`를 `testRuntimeOnly`로 추가했다. 이 두 모듈은 실행 JAR에 포함되지 않는다. 기존 Mockito 제외, ArchUnit 1.5.1, Gradle Wrapper 9.8.1과 checksum은 유지했다.

관측한 주요 실행 의존성은 Spring Framework 7.0.9, Spring Security 7.1.1, Tomcat 11.0.24, Jackson Databind 3.1.5, PostgreSQL JDBC 42.7.13, HikariCP 7.0.2다. 정확한 전체 목록은 lockfile이 원본이다. 아직 업무 DTO가 없으므로 Jackson 3의 계약 직렬화·역직렬화 인수는 후속 API 구현에서 검증한다.

Spring Boot 4.1.1은 Java 17~26과 Gradle 8.14 이상의 8.x·9.x를 지원하며, Gradle의 Java 25 toolchain·실행 지원은 9.1부터다. 현재 조합은 이 공식 지원 범위에 포함된다. [Boot 요구사항](https://docs.spring.io/spring-boot/4.1/system-requirements.html), [Gradle 호환성](https://docs.gradle.org/9.8.1/userguide/compatibility.html)

이동된 모듈·시험 설정·기본 health 동작은 [Boot 4 이전 안내](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide), 오류 설정은 [Boot 속성 안내](https://docs.spring.io/spring-boot/appendix/application-properties/index.html)를 따랐다. 승인 제품·도메인·아키텍처·계약 원본과 SPIKE 코드는 수정하지 않았다.

## 실제 실행과 결과

환경은 Windows 11, PowerShell 7.6.6, Corretto 25.0.3, Gradle 9.8.1, Node 24.19.0, npm 11.17.0, Python 3.14.0이다. 전역 Java 설정은 변경하지 않았다. `gradlew --version`에서 Launcher JVM의 Amazon.com Inc. 25.0.3과 Corretto Daemon JVM 경로를 확인했다. [JVM 관측](../../.artifacts/boot4-migration/gradle-version.log)

백엔드 디렉터리에서 의존성 lock을 갱신하며 실행했다. `--write-locks`는 의존성 변경 시에만 사용하며 정상 검증에서는 제외한다.

```powershell
$env:JAVA_HOME = 'C:\Users\jitin81\.jdks\corretto-25.0.3'
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
.\gradlew.bat --no-daemon --console=plain --warning-mode all clean build --write-locks
```

최초 실행은 6개 중 health 시험 1개가 실패했다. Boot 4의 기본 probes 활성화로 health JSON에 `groups`가 추가된 것이 원인이었다. 명시적 probes 비활성화 후 같은 시험을 다시 실행하여 통과했다. 실패를 숨기거나 기대값을 완화하지 않았다. [최초 로그](../../.artifacts/boot4-migration/gradle-build.log), [수정 후 로그](../../.artifacts/boot4-migration/gradle-build-fixed.log)

이후 루트에서 lock 갱신 없이 공식 통합 명령을 실행했다.

```powershell
pwsh -NoProfile -File scripts/verify.ps1 `
  -JavaHome 'C:\Users\jitin81\.jdks\corretto-25.0.3'
```

| 검증 | 실제 결과 |
| --- | --- |
| 루트 통합 | Exit 0 / `FOUNDATION_CHECKS / PASS`. [로그](../../.artifacts/boot4-migration/root-verify.log) |
| BE | Gradle clean build 7 tasks 실행. XML 2 suites / 6 tests, failures/errors/skipped 모두 0 |
| 기존 경계 | ArchUnit 3개와 실제 HTTP·컨텍스트 3개 통과. 요약 health, 보호 경로, 기본 계정·DataSource 부재 포함 |
| FE | 생성 타입·예제 일치, 12 tests, TypeScript 검사, Vite build, production의 개발 fixture 제외 검사 통과 |
| 계약 보호 | 20개 승인 파일 hash 일치, guard 반례 5개 및 계약 정적 검사 통과. 봉인 당시 보고서 보존 |
| 실행 JAR | Boot 4.1.1 manifest, class major 69, 실행 라이브러리 56개. JUnit/ArchUnit/Mockito/RestTestClient 시험 모듈 미포함 |
| JAR SHA-256 | `4c270736059aa72b5b419492f75a9a4e48b85b44571bdcdd3b1a71caff7ebd08` |

[패키징·시험 집계](../../.artifacts/boot4-migration/artifact-summary.json). 이 실행의 Gradle 로그에서는 이전 Boot 3.5 plugin의 `Configuration.setVisible` 경고가 관측되지 않았다. 모든 후속 작업의 무경고를 보장하는 의미는 아니다.

## 패키징 JAR·PostgreSQL 확인

기존 `infra/up.ps1`로 프로젝트 전용 PostgreSQL/Mailpit을 기동한 후, [run-backend.ps1](../../scripts/run-backend.ps1)로 두 프로필을 순차 실행했다. 다른 앱의 포트와 구별하도록 프로세스 환경 `SERVER_PORT=18080`을 사용했다. DB 비밀번호는 기존 ignored secret 파일에서 실행기가 환경으로 전달하며 명령 인수·보고서에 기록하지 않았다.

```powershell
pwsh -NoProfile -File infra/up.ps1
$env:SERVER_PORT = '18080'

# 각각 별도 실행하고 종료한 다음 다음 모드를 실행
pwsh -NoProfile -File scripts/run-backend.ps1 `
  -JavaHome 'C:\Users\jitin81\.jdks\corretto-25.0.3'
pwsh -NoProfile -File scripts/run-backend.ps1 `
  -JavaHome 'C:\Users\jitin81\.jdks\corretto-25.0.3' -WithInfrastructure

# 별도 터미널에서 HTTP 확인
Invoke-RestMethod http://127.0.0.1:18080/actuator/health

# 앱 종료 후 의존 서비스 중지
pwsh -NoProfile -File infra/stop.ps1
```

실제 자동 관측은 로컬 ignored [검증 실행기](../../.artifacts/boot4-migration/verify-runtime.py)를 `python -X utf8 .artifacts/boot4-migration/verify-runtime.py`로 실행했다. 이는 배포용 코드가 아니며 새 checkout에는 위 공식 실행 명령을 사용한다.

| 경계 | 기본 프로필 | local-infra |
| --- | --- | --- |
| health | 200 / `{"status":"UP"}` | 200 / `{"status":"UP"}` |
| PostgreSQL 원격 앱 연결 수 | 0 | 10; Hikari/JDBC 실제 연결 |
| public 업무 테이블 수 | 0 | 0 |
| 업무/관리 경로 | 아래 6개 모두 403 | 아래 6개 모두 403 |

관측 경로는 `/api/v1/rounds`, `/actuator/env`, `/actuator/configprops`, `/actuator/health/liveness`, `/actuator/health/readiness`, `/login`이다. 런타임 로그에 기본 계정 비밀번호 생성 안내가 없었으며, 기본 계정 부재 자체는 BE 컨텍스트 시험으로도 확인했다. [HTTP·DB 관측](../../.artifacts/boot4-migration/runtime-summary.json), [기본 로그](../../.artifacts/boot4-migration/runtime-default.log), [DB 연결 로그](../../.artifacts/boot4-migration/runtime-local-infra.log)

검증기가 시작한 launcher/Java 프로세스 트리를 종료하고 프로젝트 컨테이너를 중지했다. 18080/55432/58025/51025 listener가 없음을 확인했다. DB 볼륨과 기존 비밀은 보존했다. 프로세스 종료 방식은 정리 목적이며 graceful shutdown·장애 복구 인수 결과가 아니다.

## CI·통합과 남은 범위

CI는 기존 [verify.yml](../../.github/workflows/verify.yml)의 Corretto 25·Gradle Wrapper·lockfile을 그대로 사용한다. 코드 커밋 `5f968ce6c27c6a8a4a9aa3d5d965e52bad2e01b8`의 [GitHub Actions 실행 38830538809](https://github.com/songstone/auction-platform/actions/runs/38830538809)에서 `contracts`, `backend`, `frontend` 3개 job 모두 **success**를 확인했다. 이는 Ubuntu runner의 계약 검사·BE clean build·FE test/build 결과다. DB·브라우저 통합 job은 아직 없으므로 그 증거로 확대하지 않는다. [CI 관측](../../.artifacts/boot4-migration/ci-code.json)

이 문서와 실행 안내 변경은 코드 변경 다음의 별도 문서 커밋으로 기록한다. 통합 대상은 `main`이며 코드 CI 성공을 확인한 후 fast-forward로 반영한다. 최종 통합 SHA와 해당 CI 실행은 작업 완료 보고에서 제공한다. 브랜치 보호나 운영 배포 설정을 변경하는 작업은 아니다.

로컬 검증은 기존 캐시와 설치된 도구를 사용했다. 빈 캐시에서 모든 의존성을 새로 받는 실행, Linux/macOS 로컬 실행, 새 브라우저 실행, 실제 인증 세션·업무 API·migration·트랜잭션·입찰·SSE·장애 복구·성능은 이번 Boot 전환에서 NOT_RUN이다. health와 JDBC 연결 성공을 제품 수직 흐름 완성으로 판단하지 않는다. 다음 기반 작업은 승인된 공개 회차 조회의 실제 DB→API→화면 연결이다.
