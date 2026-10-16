# 개발 골격 실행 결과

이 문서는 **최초 Maven 골격을 실행한 당시 이력**이다. 이후 사용자 요청으로 백엔드 빌드를 Gradle로 전환했다. 현재 빌드·실행 명령과 전환 검증 결과는 [GRADLE-MIGRATION-VERIFICATION](GRADLE-MIGRATION-VERIFICATION.md)을 따른다. 아래 명령·hash·결과는 과거 실행 사실로 보존하며, 당시 `verify.ps1`은 Maven을 사용했다.

## 범위와 대상

2026-10-16(KST), Windows/PowerShell에서 승인 기준선 **D-095 / 공통 계약 0.1.0**의 개발 골격을 실행했다. 최초 골격 작업의 실행 결과 원본은 이 문서다. [구현 계획](IMPLEMENTATION-PLAN.md)과 [QA 계획](QA-PLAN.md)은 작업·기대값을 정의한다. 모듈 README와 backend 검증 기록의 담당자 실행표는 각각 당시 실행 이력이다.

이번 변경은 `backend/**`, `frontend/**`, `infra/**`, `scripts/**`, `.github/**`, 루트 실행 안내·Git 설정과 `docs/implementation/**`다. 기존 dirty 문서를 보존했고 commit·push·배포하지 않았다. 제품·도메인·시스템 설계·ADR·계약의 승인 파일은 수정하지 않았다. 기존 SPIKE 결과를 이번 제품 실행 결과로 합산하지 않았다.

| 식별 | 실제 값 |
| --- | --- |
| 승인 manifest SHA-256 | `1f3f6d5be1896304b5d72ede521717d6ff6440f7b10a84ff338e3bd6d3b2d795` |
| OpenAPI SHA-256 | `4cad0ae25cb48ef7891176594093374ae5007587d28ac5563fc644e21aaa527d` |
| 검증한 실행 JAR SHA-256 | `5ad0ac70822c8705a69f4c266ae4052993162d744f87835b75738e9e77bb5cee` |
| FE lockfile SHA-256 | `0d6c4c1f5931eaa327437a93de5b93a7d44d3768610693ae28e7d304885ab8b1` |
| 실제 도구 | PowerShell 7.6.6, Corretto JDK 25.0.3, Maven Wrapper 3.9.16, Node 24.19.0, npm 11.17.0, Python 3.14 |
| 로컬 서비스 | Docker Engine 28.5.1 / Compose 2.40.0-desktop.1, PostgreSQL 18.6, Mailpit 1.31.5. 이미지 digest 원본은 [compose.yaml](../../infra/compose.yaml) |
| 브라우저 관측 | Windows HeadlessChrome 155.0.0.0, Playwright CLI 0.1.22, 로컬 loopback. 지원 브라우저 인수 대상 확정 아님 |

시스템 기본 `java`는 7이었다. 기존 JDK 25를 `-JavaHome`으로 지정했고 전역 Java 설정은 변경하지 않았다. 루트 검증기는 실행 중 환경·작업 위치를 복원한다. 메일·사진 변수는 준비 입력이며 현재 업무 adapter는 없다.

## 실행 명령과 결과

저장소 루트에서 다음 통합 명령을 실제 실행했다. `-JavaHome`은 해당 실행에 사용한 설치 위치다.

```powershell
pwsh -NoProfile -File scripts/verify.ps1 -JavaHome C:/Users/jitin81/.jdks/corretto-25.0.3
```

**Exit 0 / FOUNDATION_CHECKS PASS.** [실행 로그](../../.artifacts/foundation/verify.log)는 로컬 ignored artifact다. 이 명령은 승인 원본 검사 → 변조 반례 → Python 도구 설치/계약 정적 검사 → BE `verify` → FE `npm ci`, `npm test`, `npm run build` → 승인 원본 재검사 순서다. Python 직접 검사 도구 4개는 승인 requirements의 정확 버전을 사용하며 전이 의존성 전체를 잠근 별도 Python lockfile은 아직 없다.

| QA 항목 | 결과 | 실제 관측과 범위 |
| --- | --- | --- |
| FND-01 승인 원본 | **PASS** | manifest 자체 pin과 20개 파일의 hash 일치, 변경 0. 원본 복사본에 계약·정책·manifest·승인 당시 증거를 변조한 반례 포함 5 tests PASS. 자동 새 hash 승인 없음 |
| FND-02 개발 진입 | **PASS** | 실제 도구 확인, 준비 스크립트·Compose `config --quiet`·`up -d --wait`·전용 서비스 중지 성공. 비밀 파일은 ignored 경로에 난수 생성·재사용, 화면/로그에 값 출력 없음 |
| FND-03 BE 빌드 | **PASS** | 담당자 `clean verify`와 루트 `verify` 성공. 루트 결과 6 tests, failures/errors/skipped 모두 0, 실행 JAR 생성 |
| FND-04 BE 의존성 | **PASS, 골격 범위** | ArchUnit 3 tests. 실제 production bytecode 검사와 의도적 domain/framework·내부 cross-feature 위반 fixture의 탐지 확인. 기능 패키지는 아직 비어 있어 전체 업무 의존성 준수 증거가 아님 |
| FND-05 BE health | **PASS, 골격 범위** | 기본·`local-infra` 프로필의 패키징 JAR을 각각 실제 기동. 아래 HTTP/DB 관측 참조. 업무 API·실제 인증은 미구현 |
| FND-06 FE 생성 | **PASS** | 승인 OAS에서 생성 타입·11개 예제의 정확 재현 확인, `tsc --noEmit` 성공. 금액/counter 문자열 유지. 런타임 응답 검증 아님 |
| FND-07 FE 빌드/경계 | **PASS** | FE 12 tests, fail/skip 0. Vite build와 배포 JS의 개발 마커·선택한 합성 ID 누출 검사 성공. 배포 preview URL도 직접 확인 |
| FND-08 브라우저 미리보기 | **PASS, 고정 fixture 범위** | 개발 셸·4레인 fixture, 중복 이벤트, 유찰 후 공개 최고가 제거, 개인 응답 열람, 재동기화 필요 표시 관측. 배포 셸에서는 `?preview=contract`로도 예제가 열리지 않음. 최종 console error 0 |
| FND-09 문서 추적 | **PASS, 정적 범위** | 두 계획의 UTF-8·표 19개·공식 ID 참조 220개 대조. 새 문서 9개의 로컬 링크 71개·공백 검사 성공. 제품 실행 검증과 별개 |

원래 승인 validator는 보고서를 지정 경로에 다시 쓴다. 새 [verify-contracts.py](../../scripts/verify-contracts.py)는 **실행 전 strict hash 확인** 후 OAS와 승인 validator를 byte-identical 임시 복사본으로 실행한다. 승인 당시 보고서는 보존하고 [새 정적 결과](../../.artifacts/contracts/validation-report.json)에만 출력했다. 실제 결과는 41 paths / 45 operations / 91 schemas / 716 resolved refs / positive examples 24 / operation media examples 15 / negative schema checks 38 PASS다. 이는 **CONTRACT_STATIC_ONLY**이며 HTTP 구현·DB·SSE 성공 증거가 아니다.

FE 생성에서 `openapi-typescript 7.13.0`이 mapping 없는 discriminator를 schema 이름으로 추론해 예제 타입 검사에 실패했다. 승인 OAS를 변경하지 않고 메모리 복제본에서 기존 필수 `const`로만 mapping을 기계 도출하는 호환 adapter를 추가했다. const 부재·중복·기존 mapping 충돌은 실패하며 관련 3개 반례가 FE 12 tests에 포함된다. [생성 과정과 한계](../../frontend/README.md)의 설명을 따른다.

## 실제 로컬 서비스와 JAR 관측

```powershell
pwsh -NoProfile -File infra/up.ps1
pwsh -NoProfile -File scripts/run-backend.ps1 -JavaHome C:/Users/jitin81/.jdks/corretto-25.0.3 -WithInfrastructure
# 종료 후 기본 프로필도 별도 실행
pwsh -NoProfile -File scripts/run-backend.ps1 -JavaHome C:/Users/jitin81/.jdks/corretto-25.0.3
```

각 JAR은 foreground 세션에서 실행하고 종료했다. 포트 8080·5173·4173은 실행 전 비어 있음을 확인했다. 비밀은 프로세스 환경으로 전달했고 명령 인수·로그에 넣지 않았다.

| 대상 | 실제 관측 |
| --- | --- |
| Compose | 전용 PostgreSQL·Mailpit healthy. 호스트 포트는 loopback 바인딩 |
| PostgreSQL | `current_database()` = `auction`, `server_version` = `18.6`, public tables = 0 |
| Mailpit | `GET http://127.0.0.1:58025/` → 200, Mailpit UI 확인. 실제 SMTP 수신·backend 메일 발송은 NOT_RUN |
| `local-infra` JAR | 08:51 KST 기동, `GET /actuator/health` → 200 / `{"status":"UP"}`. Hikari 연결 시작과 `pg_stat_activity`의 `PostgreSQL JDBC Driver` 세션을 관측. 업무 테이블/SQL 초기화 없음 |
| 기본 JAR | 08:53 KST 기동, `GET /actuator/health` → 200 / `{"status":"UP"}`. 같은 DB에서 remote app connections = 0으로 외부 DB 없는 실행 확인 |
| 차단 경로 | 두 프로필에서 `/api/v1/me`, `/actuator/env` → 403. 기본 프로필에서 `/login` → 403. 기본 계정 부재·CSRF는 BE 컨텍스트 검사에도 포함 |
| 기본 HTTP 원시 결과 | [runtime-default.json](../../.artifacts/foundation/runtime-default.json). 실제 호출 결과만 기록한 로컬 artifact |

공개 health의 요약 UP은 이 골격 프로세스의 상태다. 제품의 공개/회원/운영자 인증 경계, HTTP 오류 스키마, 입찰 가능 상태, 진행 권위, DB 내구성이나 업무 readiness를 증명하지 않는다. 차단용 403을 계약 API 구현 성공으로 세지 않는다.

## 브라우저 관측과 정리

FE 개발 서버는 `npm run dev`, 배포 결과는 `npm run preview`로 실제 기동했다. Playwright 스킬의 CLI 절차로 snapshot을 읽고 버튼을 선택했다. Windows에서 `npx.cmd --yes --package @playwright/cli playwright-cli --session auction-foundation ...`를 사용했다. 이 CLI는 검증 도구이며 제품 의존성/lockfile에 추가하지 않았다.

- 개발 `http://127.0.0.1:5173/`: 미구현 셸과 개발 예제 링크 확인.
- 개발 `/?preview=contract`: 고정 예제/실제 거래 없음·미연결 안내, 4레인·문자열 금액·원시각 표시 확인.
- 레인 중복 예제는 상태를 바꾸지 않음. 유찰 예제는 레인 1을 v9 / FINISHED / NO_SALE로 바꾸고 공개 최고가 표시를 남기지 않음.
- 접수 대기·원승인·원판정 ACK는 독립 응답 열람으로 표시. 실제 요청은 전송하지 않음.
- 재동기화 요구 후 모의 재동기화 필요 상태를 표시하고 추가 적용을 중지. 실제 snapshot 재조회·replay 복원 성공으로 판정하지 않음.
- 배포 `http://127.0.0.1:4173/?preview=contract`: 개발 예제·진입 링크 없이 미구현 셸만 표시. console errors 0.

첫 브라우저에서 favicon 404를 발견해 inline SVG favicon으로 해결했다. 수정 후 개발/배포 화면에서 console errors 0을 확인했다. 개발 중 index 갱신으로 낡은 element ref가 한 번 무효화되어 새 snapshot으로 재조회했다. 앱의 런타임 실패나 이벤트 복구 시험으로 집계하지 않았다.

화면 증거: [개발 예제·유찰/재동기화 표시](../../output/playwright/dev-resync.png), [배포 셸](../../output/playwright/production-shell.png). 둘 다 로컬 ignored artifact다. 실제 이미지도 확인했으며 모바일·지원 브라우저 전체·접근성 인수는 NOT_RUN이다.

종료 시 이 작업의 JAR·Vite 세션과 `auction-foundation` 브라우저를 닫고 `infra/stop.ps1`을 실행했다. 두 컨테이너 Exited(0), 사용한 6개 포트의 listener 부재를 확인했다. 볼륨·난수 비밀·사진 준비 디렉터리는 보존했다.

## 남은 구현과 검증

| 구분 | 현재 판정 |
| --- | --- |
| 계정·인증/세션·출품·회차·입찰·ACK·업무 조회·outbox/SSE·자동 진행·복구 | **NOT_IMPLEMENTED**. 실제 제품 기능 검증 NOT_RUN |
| 실제 업무 transaction·경합·old tx 차단·S/N/R·부분 실패·네트워크 재접속 | **NOT_RUN**. DB health와 fixture reducer로 대체하지 않음 |
| 제품 브라우저 통합·성능·운영 배포 | **NOT_RUN**. 100연결 등 기존 SPIKE 관측을 재사용해 통과 처리하지 않음 |
| GitHub Actions 원격 실행·보호 브랜치·필수 리뷰 적용 | **NOT_RUN / 적용 여부 미확인**. [워크플로](../../.github/workflows/verify.yml)는 추가했고 로컬 대응 명령만 실행. 이번 작업에서 GitHub 설정은 변경하지 않음 |
| Linux/macOS 실행 | **NOT_RUN**. CI는 Linux용 wrapper 명령을 포함하나 현재 관측은 Windows |
| 미정 정책·운영값 | 현행 OPEN 유지. CR-04~10·SEC 제안 수치를 임의 도입하지 않음 |

다음 병렬 착수는 [IMPLEMENTATION-PLAN](IMPLEMENTATION-PLAN.md)의 **BE-10 순수 도메인**, **FE-10/20/30 계약 기반 화면**, **QA-10 독립 인수 사례**다. BE-20의 저장/인증 기반은 함께 시작하되 OPEN-06의 실제 정책이 필요한 경로만 보류한다. 실제 접수→원판정→ACK 통합은 BE-30/40 이후 별도 제품 증거로 검증한다.
