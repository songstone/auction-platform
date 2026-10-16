# 백엔드 Gradle 전환 검증 — 2026-10-16

## 변경과 선택 이유

사용자의 “백엔드 maven 말고 gradle로 바꿔볼래? 관련 문서도 업데이트” 요청에 따라 백엔드 빌드를 전환했다. 현재 전환의 실행 결과 원본은 이 문서이며, 최초 Maven 실행은 [FOUNDATION-VERIFICATION](FOUNDATION-VERIFICATION.md)과 [백엔드 실행 이력](../../backend/verification/2026-10-16-scaffold.md)에 보존한다. 과거 명령·결과를 Gradle 실행으로 바꾸지 않았다.

| 변경 | 해결하는 문제와 이유 |
| --- | --- |
| Gradle **9.8.1** Wrapper | Java 25로 빌드 도구·컴파일·테스트를 실행한다. 정확 배포 버전과 SHA-256을 저장소에 고정하고 전역 Gradle 설치 없이 실행 |
| [build.gradle.kts](../../backend/build.gradle.kts), [settings.gradle.kts](../../backend/settings.gradle.kts) | 단일 앱의 선언 원본. Kotlin DSL로 설정 타입을 확인하며 논리 모듈을 별도 빌드 프로젝트로 분리하지 않음 |
| 기존 Boot **3.5.16** BOM을 native enforced platform으로 적용 | 기존 의존 버전을 유지하며 별도 dependency-management plugin 없이 일관된 해석. Boot·ArchUnit·Java 및 업무 소스는 기존 값 유지 |
| [gradle.lockfile](../../backend/gradle.lockfile) | 실제 해석한 프로젝트 compile/runtime/test classpath 버전을 기록. 의도한 변경 시 `--write-locks`로 갱신·diff 검토. plugin 전이 의존성 전체의 잠금까지 뜻하지 않음 |
| JUnit Platform·명시적 launcher | 기존 ArchUnit/실제 HTTP 테스트가 Gradle에서도 실행되도록 구성. Mockito 제외 유지 |
| 단일 `bootJar`, plain JAR 비활성 | 실행기가 선택할 산출물을 `backend/build/libs/auction-platform-backend-0.1.0-SNAPSHOT.jar` 하나로 고정 |
| 실행 도구·CI·문서 갱신 | 루트 검증기는 Gradle `clean build`, 실행기는 새 JAR 경로, CI는 Gradle cache/Wrapper/lockfile을 사용. backend README·작업/QA 계획의 현재 안내도 동일 기준 |

`pom.xml`, `mvnw`, `mvnw.cmd`, `.mvn/wrapper/maven-wrapper.properties`는 제거했다. `.gitignore`에는 Gradle 생성물·캐시를 제외하고, `.gitattributes`에는 Wrapper JAR의 binary 처리와 배치 파일 CRLF를 지정했다. `experiments/spike-001`의 Maven 실험과 승인 계약·정책·설계 원본은 변경하지 않았다. 시스템 설계의 “별도 Maven 모듈을 만들라는 의미가 아니다” 문장은 논리 경계의 설명이므로 빌드 도구 채택으로 해석하지 않는다.

### 공식 지원과 실제 관측의 구분

Java 25의 Gradle toolchain/runtime 공식 지원은 **9.1.0부터**다. 선택 시점 Gradle 공식 current endpoint는 최종 릴리스 **9.8.1**을 반환했다. [Gradle 호환성](https://docs.gradle.org/current/userguide/compatibility.html), [공식 버전 메타데이터](https://services.gradle.org/versions/current)

**Spring Boot 3.5.16의 공식 Gradle 지원 표는 7.x/8.x만 명시한다.** Java 25의 애플리케이션 호환성과 Gradle plugin 지원 범위를 혼동하지 않는다. 이번 요청의 범위에서 Spring Boot major를 임의 업그레이드하지 않고 기존 버전의 Gradle 9.8.1 실제 빌드·기동을 검증했다. 아래 PASS는 이 골격에서의 관측이며 공식 지원을 확대하거나 모든 후속 task의 호환성을 보장하지 않는다. [Spring Boot 요구사항](https://docs.spring.io/spring-boot/3.5/system-requirements.html), [Gradle plugin 문서](https://docs.spring.io/spring-boot/3.5/gradle-plugin/index.html)

Gradle 실행에서 사용 중단 예정 API 경고(`Configuration.setVisible`)와 향후 major 호환 경고가 남았다. 숨기거나 warning-free로 보고하지 않는다. Gradle/Boot plugin을 업데이트하거나 새로운 빌드 task를 추가할 때 이 지원 차이와 경고를 재검토한다. 빌드 시간·성능 개선은 주장하지 않는다.

## 실제 실행

Windows 11 / PowerShell 7.6.6 / Corretto 25.0.3 / Gradle 9.8.1에서 실행했다. 전역 Java·Gradle 설정은 변경하지 않았다. 다음은 `backend/`의 최초 전환 명령이며, `--write-locks`는 초기 lock 생성에만 사용했다.

```powershell
$env:JAVA_HOME = 'C:/Users/jitin81/.jdks/corretto-25.0.3'
.\gradlew.bat --no-daemon --console=plain --warning-mode all clean build --write-locks
```

기존 로컬 Gradle 배포로 공식 Wrapper를 생성했다. 생성한 Wrapper JAR을 공식 checksum과 비교한 뒤, **별도 비어 있는 `GRADLE_USER_HOME`**에서도 `gradlew.bat --version`을 실행했다. 고정 URL의 배포 다운로드·SHA-256 검증·압축 해제·JDK 25 실행 경로가 성공했다. 이 별도 실행은 Wrapper 배포 경로의 검증이며 전체 의존성을 비어 있는 캐시에서 새로 내려받아 빌드한 결과는 아니다. [Wrapper 검증 안내](https://docs.gradle.org/current/userguide/gradle_wrapper.html#sec:verification)

루트에서 변경한 통합 도구도 실제 실행했다.

```powershell
pwsh -NoProfile -File scripts/verify.ps1 -JavaHome C:/Users/jitin81/.jdks/corretto-25.0.3
```

**Exit 0 / FOUNDATION_CHECKS PASS.** Gradle `clean build`의 7 tasks가 실제 실행됐고 테스트 결과를 UP-TO-DATE로 재사용하지 않았다. 증거는 로컬 ignored [최초 Gradle 로그](../../.artifacts/gradle-migration/gradle-build.log), [Wrapper 신규 다운로드 로그](../../.artifacts/gradle-migration/fresh-wrapper.log), [루트 통합 로그](../../.artifacts/gradle-migration/root-verify.log)다.

| 검사 | 실제 결과 |
| --- | --- |
| Wrapper 배포 pin | SHA-256 `dce76f55f8e251a3a1f130eb120f30b3d271de2b76c9b0729d316b5a1b6dc01f`, 공식 값 일치·신규 다운로드 검증 성공 |
| Wrapper JAR | SHA-256 `3b8a25775a69158b5ad2b1d17a80a88dc7b40a352a73eb27d06c612a7ce68e98`, 공식 값 일치. [관측 JSON](../../.artifacts/gradle-migration/wrapper-verification.json) |
| Java/Gradle | Launcher JVM 25.0.3, Gradle 9.8.1. release 25·UTF-8 설정 |
| BE 테스트 | Gradle XML 2 suites / **6 tests**, failures/errors/skipped 모두 0. ArchUnit 3 + 기본 컨텍스트·실제 HTTP 3 |
| 프로젝트 소스 | 전환 전후 `backend/src` **17개**의 추가·삭제·SHA-256 변경 0 |
| 실행 의존성 | Maven/Gradle JAR의 `BOOT-INF/lib` **44개** 이름·SHA-256 모두 일치 |
| 패키징 | 실행 클래스 2개·YAML 2개의 SHA-256도 기존 산출물과 일치. Start-Class 정상·class major 69·test/실험 코드 없음. `build/libs`의 JAR 1개 |
| 산출물 차이 | 문서만 있는 `package-info.class` 6개는 Gradle에서 미생성. 전체 JAR byte 동일성을 주장하지 않음 |
| 최종 Gradle 실행 JAR | SHA-256 `8fd9996166b25fc1fd040d170ce451f8558939bd37be8e895c19fec937e10b48` |
| 루트 통합 | BE clean build, FE 생성 확인·12 tests·타입 검사·build·개발 fixture 제외 검사 PASS. 새 브라우저 검증은 수행하지 않음 |
| 계약/문서 보호 | 승인 manifest와 **20개** 파일 hash 일치·변경 0, guard 반례 5개 PASS. 계약 정적 검사는 별도 출력하여 봉인 보고서 보존 |
| CI 구성 | YAML/Gradle cache·lock/Wrapper·실행 명령 연결 검사 PASS. GitHub 원격 실행 NOT_RUN |

전환 전 [Maven 기준선](../../.artifacts/gradle-migration/maven-baseline.json)과 [독립 JAR/XML 비교](../../.artifacts/gradle-migration/artifact-comparison.json)는 로컬 artifact로 보존한다. 라이브러리/소스 일치는 전체 업무 동작의 동등성 증명이 아니다.

## 패키징 JAR의 실제 HTTP·DB 확인

루트 [run-backend.ps1](../../scripts/run-backend.ps1)이 새 Gradle 경로를 실행하는지 두 프로필에서 확인했다. 각 프로세스는 foreground로 기동한 뒤 종료했다. 비밀은 인수·로그로 출력하지 않고 기존 프로세스 환경 전달 방식을 유지했다.

| 프로필/경계 | 실제 결과 |
| --- | --- |
| 기본 프로필 | `GET /actuator/health` → 200 / `{"status":"UP"}`, DB remote app connections 0. [HTTP 관측](../../.artifacts/gradle-migration/runtime-default.json) |
| `-WithInfrastructure` | 같은 health 200 / UP. 실제 Hikari/JDBC 연결과 PostgreSQL 세션 관측, public tables 0. [HTTP/DB 관측](../../.artifacts/gradle-migration/runtime-local-infra.json) |
| 두 프로필의 경로 차단 | `/api/v1/rounds`, `/actuator/env`, `/actuator/configprops`, `/login` 모두 403 |
| 종료 | 시작한 JAR과 개발 컨테이너 중지. 8080/55432/58025/51025 listener 0, DB 볼륨·비밀 보존 |

기본 계정·DataSource 부재 검사는 BE 테스트에 포함된다. health·차단 403은 골격의 동작이며 실제 인증/세션·업무 API·DB 트랜잭션·입찰·SSE·장애 복구의 인수 결과가 아니다. 제품 기능·동시성·성능·운영 배포·Linux/macOS 실행·원격 CI는 이번 전환에서 **NOT_RUN**이다. 현행 OPEN과 승인 계약 0.1.0은 유지한다.

## 남은 로컬 생성물

현재 Maven 빌드 진입점은 모두 제거됐다. 기존 ignored `backend/target`의 재귀 삭제는 자동 승인 검토에서 `blocked by policy`로 거절됐으며 구체 사유는 제공되지 않았다. 해당 과거 생성물은 보존했고 새 Gradle 빌드·실행·CI에서 참조하지 않는다. 삭제를 완료했다고 보고하지 않는다. 비어 있는 `.mvn` 디렉터리가 로컬에 남아도 Git 파일이나 빌드 진입점은 아니다.
