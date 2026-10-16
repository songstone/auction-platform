# M-01 공개 회차 탐색 — 실행·인수 기록

2026-10-16, Engineering Lead. 판정: **승인된 M-01 기능 검증 PASS / dev 통합 완료**. 비회원의 `/` 목록 → 다음 페이지 → 기존 상세 → 목록 복귀와 DB 장애 후 **동일 열린 화면의 재시도 복구**를 확인했다. RELEASED·전체 R-37/R-47·인증·입찰·SSE·운영 인수 판정은 아니다.

## 기준과 커밋

사용자 승인과 실행 범위는 [M-01 리드 컨텍스트](../handoffs/M-01-LEAD-CONTEXT.md), 작업은 [T-001~004](../tasks/README.md)를 따른다. 실제 착수 때 clean checkout, 기존 worktree 없음, 환경과 선행 포함 관계를 확인했다. 제품 1.6 / DOMAIN-MODEL 1.2 / SYSTEM-DESIGN 1.0 / DECISION-LOG 1.8 / 계획·QA 0.5 / 계약 0.1.0을 입력으로 사용했다. 현재 계획·QA 0.6은 실행 결과를 안내하는 갱신이며 승인 원본 변경이 아니다.

| 단계 | 실제 시작 origin/dev | 검증 및 dev 통합 SHA |
| --- | --- | --- |
| T-001 BE 목록 | `fa4dac5c106cb114c1919aec2bdc6021f79f1958` | `658a486c1b5bc68e0cc32e92de34f1fe3234061f` |
| T-002 FE 탐색 | `fa4dac5c106cb114c1919aec2bdc6021f79f1958` | `2720ed4a6cfa84608f842f3b709002ccf5204fc2` |
| T-003 독립 검증 | `2720ed4a6cfa84608f842f3b709002ccf5204fc2` | **`89ae78c368a65522f4357616f9eebfaa89dcf084`** |
| T-004 문서 마감 | `89ae78c368a65522f4357616f9eebfaa89dcf084` | 문서 자체의 최종 SHA·CI·통합·정리는 아래 최종 인계 기록 참조 |

T-002 mock 작성 커밋은 `dd622110c518b381b42f6699983f0b03d671b859`다. T-001을 일반 merge로 반영하고 위 T-002 후보에서 실제 연동을 검증했다. 이후 각 검증 후보를 순서대로 dev에 fast-forward하여 커밋을 보존했다. main/origin/main은 `003a28fb9f2836f80ce21ed4e64f855977632eb8`이며 승격하지 않았다.

승인 제품·설계·결정·계약 보호 파일 20개의 `--strict-evidence` PASS, 계약 0.1.0 유지. manifest 재봉인·migration·의존성 변경·SPIKE 코드 복사는 없었다. [PUBLIC-ROUND](PUBLIC-ROUND-VERIFICATION.md), FOUNDATION/GRADLE/BOOT4 및 계획·인계 검토 보고서는 당시 실행 이력으로 보존했다.

## 구현된 동작

- BE: 익명 `GET /api/v1/rounds`, 명시적 공개 사실과 허용 공개 상태의 읽기 전용 SQL projection. auction 소유 레코드를 query가 쓰지 않는다. 정렬은 `scheduledStartsAt`, 정확한 `roundId` 오름차순이며 DB의 C collation과 tuple 비교를 일치시켰다.
- 내부 페이지 크기 20과 한 행 lookahead, 목록 전용 버전의 opaque keyset cursor를 사용한다. 마지막 `nextCursor=null`, 잘못된/다른 scope cursor는 400이다. 내부 크기는 제품 총수 제한이 아니며 cursor는 고정 snapshot·서명·접근 권한 보장을 제공하지 않는다.
- FE: 첫 화면 목록·빈 목록·오류·수동 재시도·더 보기, 정확 ID의 상세·직접 링크·reload·뒤로/앞으로·목록 복귀. 목록 복귀는 재조회한다. 다음 페이지 실패는 기존 행과 cursor를 유지하고 재시도 시 한 번만 추가한다.
- 생성 계약 타입과 닫힌 runtime 검사를 사용한다. unknown root/item/nested field를 거부하고 큰 문자열 counter·ID·UTC 마이크로초를 보존한다. 서울 시각 표시를 유지하며 브라우저 시각으로 상태를 진행시키지 않는다.
- 단일 진행 요청과 요청 세대/취소 처리를 사용한다. 기존 상세 404, no-store, 고정 오류/trace, DB 미구성·장애 503, 보호 경로 기본 거부를 유지했다.

## 실제 명령과 환경

각 worktree 루트에서 실행했다. 아래 최종 T-003 명령은 clean `89ae78c368a65522f4357616f9eebfaa89dcf084`에서 각각 exit 0이다. wrapper 두 명령의 배열·exit code는 `.artifacts/tasks/T-003/candidate-89ae78c/commands.json` 및 `handoff.json`에 있다. 하위 guard·환경 검사·빌드의 실행 출력은 같은 디렉터리 `fast.log`와 `integration.log`에 있다.

```powershell
python -X utf8 scripts/check-approved-baseline.py --strict-evidence
python -X utf8 scripts/test-verification-environment.py
pwsh -NoProfile -File scripts/verify.ps1 -JavaHome C:/Users/jitin81/.jdks/corretto-25.0.3
pwsh -NoProfile -File scripts/verify.ps1 -JavaHome C:/Users/jitin81/.jdks/corretto-25.0.3 -Integration
git diff --check
```

T-001은 Corretto 25를 프로세스에 주입하고 `backend/gradlew.bat -p backend --no-daemon --console=plain clean build integrationTest`를 실행했다. T-002는 `npm run check:generated`, `npm test`, `npm run build`와 위 `verify.ps1 -Integration`을 실행했다. fast 검사에는 baseline guard 회귀·계약 검증·BE build·FE 검사가 포함된다. `-Integration`은 실제 PostgreSQL `integrationTest` 뒤 portable runner를 호출한다.

| 도구 | 실제 로컬 환경 |
| --- | --- |
| OS / shell | Windows 11 `10.0.26200`, PowerShell 7.6.6 |
| Java / BE | Amazon Corretto 25.0.3.9.1 / Spring Boot 4.1.1 / Gradle Wrapper 9.8.1 |
| Node / npm / Python | 24.19.0 / 11.17.0 / 3.14.0 |
| Docker / PostgreSQL | 28.5.1 / 18.6-alpine, runner 소유 disposable DB |
| PostgreSQL image digest | `77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873` |
| Playwright / Chromium | 1.64.1 / **156.0.8078.4** |
| viewport | 1280×844, 390×844. 개발 관측 조건이며 OPEN-08 전체 지원 인수 아님 |

두 진입점에서 Spring/DB/server/management/mail/photo 및 JVM/Gradle 옵션 환경을 **빌드 전에** 제거한다. 대소문자·dot/underscore 이름을 정규화하며 원래 PowerShell 호출자 환경은 복원한다. 17개 합성 변수의 자식 전달 차단을 실제 명령과 별도 child probe로 확인했다. 외부 DB 자격정보는 사용하지 않았고 값 대신 제거된 이름만 기록했다.

로컬 wrapper가 해당 clean checkout을 빌드한 뒤 portable runner에 `--skip-build`로 넘겼다. runner 단독의 로컬 skip-build는 source/binary 연계를 독립 증명하지 않으므로 `prebuilt-artifacts-caller-responsibility`로 표시한다. 이번 연계 증거는 wrapper의 연속 build 로그·clean SHA·실행 전후 해시다. CI는 같은 workflow SHA의 backend/frontend artifact를 내려받는다.

## 검증 결과와 증거 경계

최종 로컬 run: **`20261016T144525-4b7f042d`**. 실패·오류·skip·flaky 0. 수집된 브라우저 이름과 실행된 이름 및 각 1회 PASS를 대조했다. `--list` 결과의 미실행 표시는 수집 기록이며 실제 실행 skip으로 세지 않았다.

| 분류 | 실제 결과 | 관측 범위 |
| --- | --- | --- |
| 계약/정적 | PASS | 보호 20개, baseline guard 회귀, 계약 validator·생성 freshness·타입·빌드·패키지 경계 |
| BE fast | **13 PASS** | ArchUnit 3, 기본 프로필/보안 경계 10 |
| BE 실제 PostgreSQL/HTTP | **15 PASS** | 빈 DB/migration, 상세 회귀, 공개/미공개, 47행 3페이지, 동일 시각·정확 ID·큰 counter·정밀 시각, full terminal page, malformed/foreign cursor, 무변경, DB down/up |
| FE unit | **33 PASS** | 목록 parser/loader 포함. abort를 무시하는 지연 응답 폐기는 제어 가능한 promise를 사용하는 단위 반례 |
| 독립 목록 HTTP | **39 expectation cases PASS** | seeded 34 + 미구성/빈 DB/빈 tail/down 2개 조건 각 1. 승인 canonical schema로 검사 |
| 기존 상세 HTTP | **6 expectation cases PASS** | 정상 5 + 실제 DB down 1. 위 목록 수와 별도 |
| 실제 서버 브라우저 | **15 PASS** | empty 2, up 7, discovery 2, changed 1, down 1, recovery 2 |
| 합성 HTTP fault 브라우저 | **7 PASS** | unknown root/item/nested, 숫자 counter, 잘못된 날짜, 동일 cursor 재시도·중복 append 방지, 지연 요청 취소 |
| 실패/복구 | **PASS, 공개 조회에 한정** | 아래 동일 열린 Page의 실제 DB 중단/복귀 |
| 로그/정리 | PASS | 이번 주입 비밀의 log/HTTP/trace ZIP/summary 검사, fixture 배포 제외, 자기 프로세스·DB·volume·listener 정리 |

브라우저 총 **22건 = 실제 15 + 합성 7**이다. 합성 취소 사례는 취소된 요청의 fulfillment가 거부될 수 있어 abort 무시 응답 도착을 증명하지 않는다. 강한 지연 응답 반례는 FE 단위 증거로 분리한다. HTTP expectation 수는 요청 총수나 제품 AC 완료 수가 아니다.

독립 fixture는 58행(공개 53·숨김 5)이다. 공개 53개를 두 번 3페이지로 탐색하고 정렬·중복/누락·마지막 null·cursor replay를 확인했다. 모든 허용 공개 상태, 같은 시각의 대소문자/공백/한글 ID, 예약문자 ID ` QA/한글 +%?#= `, 큰 counter와 마이크로초를 포함한다. 공개 읽기 전후 전체 행 fingerprint는 `559313d5af7ffd832c32988713a65090`으로 동일했다. empty tail 실험의 합성 데이터 변경은 runner가 자기 DB에서 수행하고 원상 복원했다.

1280/390 각각 첫 화면 → 전체 53개 → 예약문자 ID 상세 → 목록 복귀 및 history를 실행했다. 익명 cookie 0, 관측 console error 0. 리드는 최종 empty/mobile, 전체 목록/desktop, 예약문자 상세/mobile 및 DB 오류/복구 화면을 독립 열람하여 겹침·가로 넘침을 발견하지 않았다. 자동 DOM/overflow 검사와 screenshot의 시각 검토를 구분한다.

### 동일 열린 화면 복구

각 viewport에서 목록을 연 뒤 동일 backend PID `6596`을 유지하고 runner 소유 DB 컨테이너를 실제 중단했다. HTTP 503과 오류 화면·안전한 안내를 확인하고 DB를 같은 포트로 재시작한 뒤 **그 Page의 재시도 버튼**으로 목록을 회복했다.

- `pageCount=1`, main-frame `navigations=1`, document marker 유지.
- 시작/종료 URL 동일. 브라우저 reload나 새 Page로 성공을 대체하지 않음.
- 양쪽 모두 `sameDatabasePort=true`, 동일 container, 동일 backend PID.
- recovery report의 `same-page-proof` 첨부와 `before-loss.png`, `database-down.png`, `same-page-recovered.png`, 성공 trace 보존.

이는 조회 의존성 단절/복귀 증거다. 원접수·잠금·commit 불명·세션·SSE·업무 진행 재개의 증거는 아니다. 과거 상세 보고서와 T-002의 별도 새 페이지 복구 증거는 그대로 그 범위에 머문다.

## 동일 빌드와 원시 artifact

| 대상 | SHA-256 |
| --- | --- |
| 실행 JAR | `a355e6db53380c8d1cedb5ab59597dd0eac314793f1ca04431afe755945d6113` |
| frontend dist 파일 집합 | `7558dcd8d7dcae701bc17b742ff75e08bbb33ecf54db915cccdacb93a51fca9d` |

개별 JS/CSS/HTML 해시와 실행 전후 동일성은 summary에 있다. fixture는 migration/application resource가 아니며 JAR/dist 제외 검사를 통과했다. 원시 결과는 Git에 넣지 않고 **루트 checkout의 같은 상대 경로**에 복사하여 파일별 hash를 대조했다.

| 원시 자료 | 루트 기준 위치 |
| --- | --- |
| 착수 환경·CI 조회·독립 리뷰·archive/cleanup 기록 | `.artifacts/tasks/m01-lead/` |
| T-001 최초 실패/수정/최종 | `.artifacts/tasks/T-001/20261016-be-first/`, `20261016-be-port-fix/`, `20261016-be-final/` |
| T-002 mock/실제 | `.artifacts/tasks/T-002/mock-20261016/`, `actual-20261016/`; `.artifacts/integration/20261016T142045-ad93fb8b/` |
| 최종 명령·17개 환경 이름·BE XML·HTML ZIP·handoff | `.artifacts/tasks/T-003/candidate-89ae78c/` |
| 최종 DB/HTTP·해시·cleanup·secretScan | `.artifacts/integration/20261016T144525-4b7f042d/summary.json` 및 같은 디렉터리 |
| 최종 browser report·PNG·trace | `output/playwright/round-discovery/20261016T144525-4b7f042d/`의 phase별 디렉터리 |
| 실제 DEV preview | `output/playwright/t002-dev-preview/evidence.json`, `dev-contract-preview-1280.png` |
| T-004 최종 SHA·CI·dev·정리 | `.artifacts/tasks/m01-lead/final-handoff.json` — 최종 통합/정리 후 생성, 최종 응답에도 기록 |

DEV preview는 T-002 `2720ed4...`에서 실제 Vite/Chromium으로 개발 표시·API 무요청·console 오류 0을 확인했고 완성 화면 PNG를 보존했다. 초기 loading YAML은 완성 화면 snapshot이 아니다. 추가 YAML 재수집을 위한 임시 Vite/browser 실행은 자동 승인 검토에서 `blocked by policy`로 거부되어 NOT_RUN, 완성 상태 raw snapshot은 NOT_CAPTURED다. 기존 PNG/관측의 범위를 확대하지 않았다.

## 실패·리뷰·해결 이력

| 관측 | 처리와 최종 경계 |
| --- | --- |
| T-001 최초 실제 DB 검사 14건 실패 | 컨테이너 재시작 때 동적 host port가 바뀜. 시험의 임의 loopback port를 명시적으로 바인딩하고 재시작 동일성을 검사. 해당 사례와 최종 clean 전체 재실행 PASS. 제품 설정 변경 없음 |
| T-003 `5c5405e...` 환경 상속 리뷰 차단 | build/test 전에 원래 Spring/DB 환경이 전달될 수 있음. 진행 검증을 중단하고 소유 process 종료 확인. 통합 결과 INTERRUPTED/NOT_RUN으로 보존 |
| `e049f21...` 실행 PASS 후 dotted-name 리뷰 차단 | 표준 prefix 정화만으로 dotted Spring property가 남음. dot/underscore 정규화와 3종 추가 sentinel로 보정. 이 실행은 SUPERSEDED_DIAGNOSTIC_PASS이며 최종 인수 근거로 대체 사용하지 않음 |
| 최종 `89ae78c...` | BE 독립 정적 리뷰 PASS, FE E2E 독립 리뷰 PASS(그 뒤 E2E 변경 없음). 환경 회귀·fast·전체 Integration·CI 모두 PASS |
| Windows 긴 artifact 경로 | BE HTML 일반 복사 한계를 ZIP 보존으로 해결. 시험 실패와 구분. 루트 복사는 extended path와 hash 대조 사용 |
| T-001 worktree 잔여 폴더 | Git 등록 제거는 완료했으나 긴 경로 오류로 파일 일부가 남음. native recursive force 삭제는 자동 승인 검토가 `blocked by policy`로 거부. 잔여 폴더를 보존하고 Git branch/등록 정리와 구분 |

추가 보정은 DB readiness subprocess timeout, 최종 summary/error/ZIP까지 주입 비밀 검사, 검출 시 redaction과 FAIL 및 안전 확인 후 CI 업로드 marker 생성이다. 검출된 누출을 성공으로 처리하지 않는다. 이번 최종 실행은 검출/scan failure 0이며 redaction이 필요하지 않았다. 검사 범위 밖 모든 비밀·보안 보장을 의미하지 않는다.

## CI와 통합·정리

| 검증 후보 | 원격 CI | 결과 |
| --- | --- | --- |
| T-001 `658a486...` | [38854783248](https://github.com/songstone/auction-platform/actions/runs/38854783248) | contracts/backend/frontend/integration 모두 success |
| T-002 `2720ed4...` | [38855147679](https://github.com/songstone/auction-platform/actions/runs/38855147679), [dev 38855588592](https://github.com/songstone/auction-platform/actions/runs/38855588592) | 4개 모두 success |
| T-003 `89ae78c...` | [38857236314](https://github.com/songstone/auction-platform/actions/runs/38857236314), [dev 38857654664](https://github.com/songstone/auction-platform/actions/runs/38857654664) | 후보 CI 4개 success 후 dev FF/push, dev CI도 4개 success |

CI의 `public-round-integration-evidence` artifact에 새 DB/HTTP/브라우저 증거를 포함한다. 원격 보호 브랜치·필수 리뷰의 기술적 강제 설정은 조회하지 않았으며 설정됐다고 주장하지 않는다.

T-001~003은 fetch 후 **로컬/원격 tip 각각**이 origin/dev의 조상임을 exit 0으로 확인하고 소유자 작업 종료·clean·원시 archive를 확인했다. 세 작업의 로컬/원격 branch와 Git worktree 등록을 삭제했다. T-002/T-003 폴더는 제거됐고, T-001 잔여 폴더 `C:/Users/jitin81/Documents/dev/private/auction-platform-worktrees/t-001`은 위 사유로 남았다. 작업 커밋은 dev에 모두 보존했다. disposable runtime cleanup은 PASS이며 잔여 소스 폴더와 다르다.

T-004는 이 보고서의 독립 리뷰·strict guard·문서 링크/필수 필드·diff 검사 및 **자기 최종 커밋의 4개 CI** 후 dev로 통합한다. 이 문서 생성 시점에는 T-004 자체 통합/정리가 아직 미래이므로 성공을 미리 기재하지 않는다. 최종 정확 SHA·CI·branch 정리는 위 `final-handoff.json`과 사용자 최종 인계에 기록한다. 문서만 변경하므로 로컬 전체 runtime을 불필요하게 반복하지 않으며 원격 필수 CI는 실행한다.

## 남은 범위와 다음 준비

**NOT_RUN / NOT_IMPLEMENTED:** 실제 인증·세션/CSRF 수명, 출품·사진, 운영자 회차 생성·공개/시작 명령, 자동 경매·입찰·공식 접수순서·원판정/ACK, SSE·재생/복구, 동시성·성능·운영 배포/복원. 전체 R-37·R-47·R-49 인수, OPEN-08 전체 지원 환경, RELEASED 및 main 승격도 이번 범위가 아니다.

M-02는 정책 준비만 인계한다. [CONTRACT-REVIEW-001](../decisions/CONTRACT-REVIEW-001.md)의 CR-10·SEC-01~04 및 [ROADMAP M-02](../ROADMAP.md)를 기준으로 작은 묶음의 결정을 받는다. 기존 제안 수치를 승인값으로 채택하지 않는다.

1. 이메일 정규화·중복 판정·검증 전 자격·운영/회원의 동일 이메일 처리. 역할 분리와 별도 회원 참여는 기존 승인이고 동일 이메일 허용은 미정이다.
2. 비밀번호 Unicode/길이/차단, 검증·재설정 토큰의 수명·일회성·동시 사용·응답 유실·메일 실패, 재설정 후 세션/남은 토큰 무효화.
3. 세션 idle/absolute·갱신·복수 기기·로그아웃·ID 교체, 운영 계정 준비, 계정 존재 비노출·시도/메일 제한·비밀 보호. 해시 비용/저장 adapter/메일 사업자의 구현 선택은 정책 승인과 구별한다.

결정 뒤 Contract Owner가 정확 diff·예제·호환성·BE/FE/QA 영향을 준비하여 ADR-005를 적용하고 별도 M-02 카드를 만든다. 이번에 M-02 구현을 시작하지 않았다.
