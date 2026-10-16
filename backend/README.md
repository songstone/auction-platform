# Backend 개발 골격

승인된 [SYSTEM-DESIGN 1.0](../docs/architecture/SYSTEM-DESIGN.md)과 [공통 계약 0.1.0](../contracts/README.md)을 구현할 단일 Gradle 앱이다. 현재 구현은 프로세스 시작, Actuator 요약 health, 나머지 경로 차단과 패키지 경계 검사다. 계정·출품·입찰·원판정·ACK·SSE·복구·진행 권한은 구현하지 않았다.

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

## 외부 서비스 없는 기본 실행

```powershell
& "$env:JAVA_HOME\bin\java.exe" -jar build/libs/auction-platform-backend-0.1.0-SNAPSHOT.jar
```

기본 주소는 `127.0.0.1:8080`이며 `SERVER_ADDRESS`·`SERVER_PORT`로 바꿀 수 있다. 현재 공개하는 HTTP 기능은 `GET /actuator/health`의 상태 요약뿐이다. details·components·env/configprops 등 관리 정보는 공개하지 않는다. 자동 생성 기본 계정·HTTP Basic·로그인 폼을 설치하지 않는다. CSRF와 기본 보안 응답 헤더는 유지한다.

health의 `UP`은 이 골격 프로세스의 요약 상태다. 정상 입찰 접수, DB 내구성, authority 확보, schema/migration, 메일/사진 연계, 업무 readiness를 증명하지 않는다. 차단된 `/api/v1/...`의 403이나 아직 없는 API의 404는 계약 구현 완료·인수 PASS가 아니다. 보안 차단은 실제 인증·세션 계약 구현 때 승인된 공개/개인 경계로 교체한다.

기본 profile은 DataSource auto-configuration을 명시적으로 제외한다. JDBC·PostgreSQL driver 의존성은 준비돼 있지만 기본 실행은 DB에 연결하거나 테이블을 만들지 않는다.

## 준비된 로컬 인프라 연결

[.env.example](.env.example)은 준비 변수의 안내이며 Spring Boot가 자동으로 읽는 비밀 파일이 아니다. 저장소 루트의 실행 도구가 환경을 주입하거나 사용자가 직접 프로세스 환경에 설정한다.

| 환경 | 준비 값 / 실제 연결 상태 |
| --- | --- |
| `SPRING_PROFILES_ACTIVE=local-infra` | 명시적으로 활성화할 때만 실제 DataSource를 구성. schema·migration·업무 adapter는 없음 |
| `DB_URL` | 기본 `jdbc:postgresql://127.0.0.1:55432/auction` |
| `DB_USER` | 기본 `auction` |
| `DB_PASSWORD` | **필수 런타임 비밀**. 예제에 비밀번호를 넣지 않으며 로그·명령 인수로 출력하지 않음 |
| `MAIL_HOST` / `MAIL_PORT` | `127.0.0.1` / `51025`, Mailpit 준비 입력. 메일 adapter·메일 발송은 미구현 |
| `PHOTO_ROOT` | 루트 실행기가 `infra/.runtime/photos`의 절대 경로를 전달할 준비 입력. 파일 adapter·업로드는 미구현 |

루트 인프라 도구는 자체 생성 비밀을 `infra/.runtime/db-password`에서 관리한다. 이 앱은 그 파일을 직접 읽지 않는다. [run-backend.ps1](../scripts/run-backend.ps1)의 `-WithInfrastructure` 옵션이 DB 비밀과 준비 변수를 프로세스 환경으로 전달한다. 실제 인프라 준비·실행 명령은 [infra 안내](../infra/README.md)를 따른다.

`local-infra`에서 `${DB_PASSWORD}`가 해석되지 않으면 시작을 계속하지 않는다. SQL 자동 초기화도 `never`이며 데이터 파괴·개발 fixture 주입은 없다. 이 profile의 DB health가 성공해도 업무 트랜잭션·승인 조건을 검증한 것은 아니다.

## 패키지와 검사

[MODULE-BOUNDARIES.md](MODULE-BOUNDARIES.md)는 코드 위치·검사 연결을 설명한다. 책임의 공식 원본은 시스템 설계이고 정책·계약 원본은 수정하지 않는다.

- `ArchitectureRulesTest`: 실제 production bytecode의 계층·기능 의존성/순환 검사와 의도적 위반 fixture를 사용한 guard 확인.
- `InfrastructureBoundaryTest`: 외부 서비스 없는 기본 컨텍스트·요약 health·관리/업무 경로 차단·기본 계정 부재 확인.

빈 기능 패키지의 경계는 앞으로 추가되는 코드에 적용할 검사다. 음성/양성 fixture 검사가 경계 규칙의 작동을 확인해도 실제 경매 구현의 정합성·완전한 모듈 구현을 입증하지 않는다. 현재 Corretto 25·Spring Boot 4.1.1·Gradle 9.8.1의 실행 결과는 [Spring Boot 4 전환 검증 기록](../docs/implementation/BOOT4-MIGRATION-VERIFICATION.md)을 따른다.

초기 Maven 골격의 실제 명령·산출물·검증 범위는 [2026-10-16 백엔드 실행 이력](verification/2026-10-16-scaffold.md)과 [초기 통합 실행 이력](../docs/implementation/FOUNDATION-VERIFICATION.md)에 보존한다. Spring Boot 3.5.16에서 수행한 빌드 도구 전환은 [Gradle 전환 실행 이력](../docs/implementation/GRADLE-MIGRATION-VERIFICATION.md)에 보존한다. 각 기록은 당시 버전의 실행 사실이며 현재 Spring Boot 4 실행 결과로 치환하지 않는다.
