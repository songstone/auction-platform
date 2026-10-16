# M-01 실행 리드 세션 컨텍스트 — 공개 회차 탐색

## 1. 역할과 승인된 목표

너는 이 저장소의 **M-01 실행 Engineering Lead**다. 아래 승인 범위의 착수 조건을 확인하고, 기존 작업지시서를 담당자에게 배정하여 구현·독립 검증·CI·dev 통합·브랜치 정리까지 이끈다. 구현 결함은 원담당에게 재배정하고 리드는 공식 상태와 통합을 관리한다.

- 저장소: `C:/Users/jitin81/Documents/dev/private/auction-platform`.
- 승인: **2026-10-16 사용자 응답 “승인”**. 직전 질문은 “전체 로드맵과 M-01을 첫 실행 범위로 삼는 안”의 승인 요청이었다.
- 승인 대상: `49bec92cc33e8a61dc5fa5d3f6c7c84432f78d7d`의 [ROADMAP](../ROADMAP.md)·[BACKLOG](../BACKLOG.md) 0.1 제안. 현재 두 문서는 내용 범위를 유지한 승인본 1.0이다.
- 승인 범위: 7개 마일스톤의 순서·사용자 흐름·DoD·의존성/위험 검증 원칙과 첫 실행 M-01 공개 회차 탐색. **이 범위를 다시 승인받지 않는다.**
- 이 문서를 작성한 계획 세션에서는 구현을 시작하지 않았다. 실행 세션에서 최신 기준·담당/worktree·검증 환경을 실제 확인한 뒤 T-001/T-002를 READY로 전환한다. 사용자 승인만으로 미확인 착수 정보를 채우지 않는다.
- M-02~07의 세부 Task·클래스/DDL·미정 CR/SEC 값·운영 배포·main 승격은 이번 실행 범위에 포함하지 않는다. 승인된 제품/계약 의미를 바꿔야 할 때만 ADR-005에 따라 구체 변경안의 승인을 요청한다.

**사용자 흐름:** 비회원 첫 화면 `/` → 공개 회차 목록/다음 페이지 → 선택한 기존 상세 → 목록 복귀. 빈 목록과 장애를 구별하고, DB 복귀 후 **동일 열린 오류 화면에서 재시도**하여 정상 목록을 확인한다.

## 2. 반드시 읽을 원본

| 순서 | 원본과 확인할 내용 |
| --- | --- |
| 1 | [AGENTS](../../AGENTS.md): 최신 dev 기반 작업, 단일 공유 파일 소유자, 기존 dirty 보존, CI·통합·정리 규칙 |
| 2 | [STATE](../STATE.md), [ROADMAP](../ROADMAP.md), [BACKLOG](../BACKLOG.md): 승인 범위·현재 구현/검증 상태·M-01 DoD |
| 3 | [IMPLEMENTATION-PLAN](../implementation/IMPLEMENTATION-PLAN.md), [QA-PLAN](../implementation/QA-PLAN.md): 계층/소유권·증거 분류·미실행 경계 |
| 4 | [M-01 운영안](../tasks/README.md), [T-001](../tasks/T-001.md), [T-002](../tasks/T-002.md), [T-003](../tasks/T-003.md), [T-004](../tasks/T-004.md): 기존 작업 범위·선행·파일 소유권·명령·인수 조건 |
| 5 | [MVP-PRD](../product/MVP-PRD.md), [AUCTION-RULES](../product/AUCTION-RULES.md), [DOMAIN-MODEL](../architecture/DOMAIN-MODEL.md): R-37 공개 접근 일부, R-47 개발 화면 관측, INV-26 정보 경계 |
| 6 | [SYSTEM-DESIGN](../architecture/SYSTEM-DESIGN.md), [MODULE-BOUNDARIES](../../backend/MODULE-BOUNDARIES.md): auction 레코드 소유·query 읽기 projection |
| 7 | [OpenAPI](../../contracts/openapi.yaml), [계약 안내](../../contracts/README.md), [승인 manifest](../../contracts/approved-baseline-0.1.0.json), [ADR-005](../decisions/adr/ADR-005-CONTRACT-BASELINE.md), [DECISION-LOG](../decisions/DECISION-LOG.md): 계약 0.1.0 및 남은 OPEN |
| 8 | [PUBLIC-ROUND-VERIFICATION](../implementation/PUBLIC-ROUND-VERIFICATION.md), [로드맵 검토 이력](../implementation/ROADMAP-REVIEW-2026-10-16.md), [이번 인계 검토](../implementation/M-01-HANDOFF-REVIEW-2026-10-16.md): 기존 상세·문서 증거의 범위 |

제품 1.6, DOMAIN-MODEL 1.2, SYSTEM-DESIGN 1.0, DECISION-LOG 1.8, 계약 0.1.0이 현재 입력이다. 실행 시 버전·무결성을 다시 확인한다. 보호 원본이 바뀌었으면 차이와 승인 근거를 확인하며 해시를 새로 써서 통과시키지 않는다.

## 3. 현재 사실과 착수 확인

인계 조사 시 fetch한 `origin/dev`는 `49bec92cc33e8a61dc5fa5d3f6c7c84432f78d7d`였다. 이는 **승인된 계획과 조사 기준**이며 다음 세션의 구현 착수 SHA가 아니다. 이 인계 문서 통합만으로도 dev tip은 이동한다. `e5ebde8...`·`a8d4df6...` 등 기존 조사 SHA도 실제 시작 값으로 복사하지 않는다.

- 구현된 흐름: `/?roundId=<ID>` → `GET /api/v1/rounds/{roundId}` → PostgreSQL → React. 검증 구현 SHA는 `39fb9e147c6e9b04dc5f763f164b6e2c349c4dca`다.
- 공개 회차 목록은 미구현이다. 첫 화면은 상세 링크 안내이며 identity/listing/자동 경매/입찰/실제 SSE도 미구현이다. 개발 preview/fixture는 실제 기능이 아니다.
- 기존 `verify-integration.py`는 상세 전용 HTTP 검사와 기존 합성 데이터/브라우저 사례를 실행한다. DB down/up 때 별도 브라우저 실행의 성공은 같은 화면 재시도 증거가 아니다. 새 목록·복수 페이지·빈 목록·동일 페이지 복구 사례를 T-003에서 실제로 추가해야 한다.
- 작업 카드 4개는 DRAFT다. **범위 승인은 완료**, 구현 담당·실제 SHA·worktree·환경/선행 확인은 아직 미배정이다. 구현 활성 수는 0/2다.

실행 세션 첫 작업은 아래 읽기 검사다. dirty나 타 worktree가 있으면 보존하고 격리한다. `dev`/`main`에서 직접 기능을 구현하지 않는다.

```powershell
git status --short --branch
git fetch origin --prune
git rev-parse HEAD origin/dev origin/main
git branch -vv
git worktree list
python -X utf8 scripts/check-approved-baseline.py --strict-evidence
```

그 다음 Corretto 25, Gradle Wrapper 9.8.1, 프로젝트가 요구하는 Node/npm·Python/계약 validator·PowerShell, Docker 및 disposable DB/Chromium 검사 환경을 확인한다. Java는 검증한 경로를 `AUCTION_JAVA_HOME`/`-JavaHome`으로 프로세스에 주입한다. 비밀이나 운영 DB 정보를 명령 인수·로그·문서에 넣지 않는다.

리드가 각 카드에 다음을 실제 값으로 기록한 뒤 READY 판정한다: 승인 근거, 최신 origin/dev의 **40자리 SHA**, 계약 버전/guard 결과, 담당자, 실제 branch/worktree, 편집 소유권, 검증 환경, 선행 검증/통합 SHA와 포함 관계. 이미 충족된 범위 승인을 다시 요청할 필요는 없다. 환경 실패는 원인과 재개 조건을 기록하며 성공 skip으로 처리하지 않는다.

## 4. M-01의 계약과 범위

사용할 operation은 `listPublicRounds`와 기존 `getPublicRound`다. 실제 경로는 `/api/v1/rounds`, `/api/v1/rounds/{roundId}`이며 정확한 필드·오류·표현의 원본은 OpenAPI다.

- `PublicRoundPage`/`PublicRoundState`의 닫힌 schema를 그대로 소비한다. 목록 정렬은 `scheduledStartsAt`, `roundId` 오름차순, `nextCursor=null`이 끝이다.
- cursor는 opaque이며 서버가 반환한 값을 전달한다. stream cursor와 혼용하지 않는다. 페이지 크기·cursor 내부 인코딩·SQL 계획은 구현 선택으로 검토하되 제품 상한이나 목록의 고정 snapshot 보장을 추가하지 않는다.
- 명시적 공개 사실과 허용 공개 상태를 기준으로 조회한다. 예약/공개 시각만으로 상태를 추정·변경하지 않는다. query는 auction 소유 기록에 대한 읽기 projection을 사용한다.
- 문자열 counter·정확한 opaque ID·UTC 정밀도와 서울 시각 표시를 유지한다. 성공/오류의 no-store, 공통 오류/trace, 미공개 상세 404, DB 미구성/장애 503, 보호 경로 기본 거부를 회귀한다.
- 상품 목록/사진, 실제 인증·세션, 회차 생성/공개/시작 명령, 4레인 실시간·입찰·SSE는 M-01 범위 밖이다. 기존 V1을 재사용하고 migration에 합성 데이터·계정을 넣지 않는다.
- Chromium desktop 1280px/mobile 390px를 기존 카드의 **개발 관측 조건**으로 사용하고 정확한 실행 환경을 남긴다. OPEN-08의 전체 지원 환경이나 AC-R47-01 전체 완료로 해석하지 않는다. OPEN-06/13 및 운영 정책 대기가 이 공개 탐색을 막는 선행조건은 아니다.

## 5. 배정·병렬화·통합 순서

초기 구현 활성은 **최대 2명**이다. 기존 카드에 적힌 branch/worktree는 제안명이며 이번 계획 세션에서 생성하지 않았다. 실행 리드는 충돌·점유 여부를 먼저 확인한다.

| 단계 | 담당과 허용 작업 | 다음 단계의 실제 조건 |
| --- | --- | --- |
| 1 | T-001 BE A: 공개 목록 API·실제 PostgreSQL/HTTP 검사. T-002 FE B: 같은 승인 계약의 mock 기반 목록/상세 이동을 병렬 개발 | 각 최신 기준 SHA·별도 worktree·소유권 기록 |
| 2 | T-001 독립 리뷰·검증·CI 후 dev 통합. T-002가 그 실제 통합 SHA를 반영하여 실제 API와 기존 E2E smoke 확인 | T-001 tip의 origin/dev 포함, FE mock과 실제 연동 증거 분리 |
| 3 | T-002 리뷰·검증·CI·통합 후 T-003 독립 QA/통합 담당이 harness·fixture·새 E2E 확장 | T-001/T-002 tip 포함·해당 통합 버전 CI 성공·공유 파일 소유권 인계 |
| 4 | T-003 검증/CI·통합 후 T-004 리드 인수·보고·상태 마감 | 같은 빌드의 원시 증거·cleanup·실제 통합 SHA 대조 |

통합 순서는 **T-001 → T-002 → T-003 → T-004**다. QA의 독립 기대값 읽기 검토는 미리 가능하지만 T-003 코드 작성·실행은 선행 통합 뒤에 배정한다. FE mock 완료를 서버 연동 완료로 처리하지 않는다.

파일 소유권은 [기존 운영안](../tasks/README.md#충돌-위험과-변경-소유권)을 그대로 따른다.

- T-001: query/목록 HTTP 및 BE 조립·정확 GET 보안 경계·관련 시험. build/lock/application/migration은 기본 변경 잠금이며 필요 근거를 리드에게 제출한다.
- T-002: FE 화면/상태/단위 검사와 기존 `public-round.spec.ts`의 목록→상세→복귀 smoke. 생성 타입은 공식 명령으로만 생성한다. package/lock·Vite/Playwright 공통 설정은 리드 조정 대상이다.
- T-003: 인계 후 `scripts/**`, 필요한 `infra/fixtures/**`·CI artifact 설정 및 새 `round-discovery.spec.ts`. 제품 결함은 원담당에게 반환한다. 기존 FE E2E/공통 설정 수정은 소유권 재배정 후 한다.
- 리드: STATE/카드/공식 보고서·현재 가이드. 승인 제품/설계/결정/계약 파일은 읽기 전용이며 Contract Owner 절차 없이 수정하지 않는다.

## 6. 인수 증거와 검증 명령

| 증거 | 필요한 관측 |
| --- | --- |
| 실제 DB/HTTP | 빈 DB 목록, 공개/미공개 필터, 같은 예약 시각 정렬, 페이지 경계보다 많은 합성 데이터, 반복 탐색의 중복/누락 없음, 마지막/빈 페이지·잘못된 cursor, 정확 schema/큰 counter/시각/ID |
| 실제 브라우저 | 비회원 첫 화면→복수 페이지→예약문자 ID 상세→목록 복귀·뒤로가기, 기존 직접 링크/새로고침/상세 오류 회귀, desktop/mobile 개발 조건 |
| 실패와 복구 | DB 중단의 실제 HTTP 503/화면 오류, 복귀 뒤 **같은 열린 페이지에서 재시도**해 목록 회복. 새 페이지 조회로 대체 금지 |
| 합성 fault/mock | 알 수 없는 필드·잘못된 응답의 FE 거부, 지연 응답/재시도 중복 append 반례. 실제 DB/HTTP 증거와 별도 표시 |
| 보호·정리 | 승인 원본 불변, 미공개/private 누출 없음, JSON no-store·고정 오류·비밀 없는 로그, fixture 배포물 제외, 자기 disposable 자원 cleanup |

기존 시험 통과 횟수를 새 기능의 기대 결과로 재사용하지 않는다. 각 카드의 새 사례가 실제 수집·실행됐는지 확인한다. `verify.ps1 -Integration`과 이식형 runner는 역할이 다르므로 아래 설명과 개별 카드 명령을 따른다.

```powershell
# 실행 worktree 루트. 각 명령의 exit code와 artifact를 각각 기록한다.
python -X utf8 scripts/check-approved-baseline.py --strict-evidence
pwsh -NoProfile -File scripts/verify.ps1 -JavaHome $env:AUCTION_JAVA_HOME
pwsh -NoProfile -File scripts/verify.ps1 -JavaHome $env:AUCTION_JAVA_HOME -Integration
git diff --check
```

T-001의 실제 PostgreSQL은 `backend`의 명시적 `integrationTest`를 실행한다. T-002는 `check:generated`, `npm test`, `npm run build` 및 T-001 포함 버전의 실제 E2E를 확인한다. 이식형 DB/HTTP/브라우저 실행 경로를 쓰면 `python scripts/test-baseline-guard.py`·`python scripts/verify-contracts.py`를 별도로 먼저 실행하고 `python scripts/verify-integration.py --java-home $env:AUCTION_JAVA_HOME --install-browser`를 사용한다. 이는 빠른 BE/FE 검사 전체를 자동 대체한다는 뜻이 아니다.

Docker 미가용은 실제 DB 검증 PASS가 아니다. 개발/운영 DB를 사용하지 않는다. 원시 결과는 `.artifacts/integration/<run-id>/`, `output/playwright/` 및 `.artifacts/tasks/T-xxx/<run-id>/`에 보존하고 Git에는 비밀 없는 요약을 남긴다.

## 7. 중단·완료·다음 인계

승인 hash 불일치, 의미/권한 확대 필요, private 노출, 실제 의존 SHA 부재, 시험 인프라의 개발/운영 DB 접근, FAIL/cleanup 실패, 미통과 CI, 파일 소유권 충돌이면 **영향 작업만** 중단해 원인·범위·필요 조치·재개 조건을 기록한다. 단순 내부 구현 선택은 리드/담당자가 해결하고 이미 승인된 M-01 범위를 재승인 요청하지 않는다. 계약 변경이 필요하면 정확 diff·예제·호환성·BE/FE/QA 영향을 준비한 뒤 ADR-005를 따른다.

각 작업의 검증 후보 SHA와 contracts/backend/frontend/integration CI 성공을 확인한 후 최신 dev에 FF 또는 일반 merge·push한다. 병합 해결로 코드가 바뀌면 해당 변경을 다시 검증한다. fetch 후 **로컬·원격 task tip 모두** origin/dev의 조상인지와 다른 worktree 점유 여부를 확인한 다음 완료 branch만 안전하게 삭제한다. 미병합 branch·main/dev는 보존하며 root checkout은 dev에 둔다.

마감 산출물은 기존 T-004가 정한 `docs/implementation/ROUND-DISCOVERY-VERIFICATION.md`, 갱신 STATE/카드·가이드, 정확 검증/통합 SHA·명령·CI/artifact·cleanup·FAIL/NOT_RUN이다. 전체 R-37(상품/실시간 포함), R-47, 인증/입찰/SSE/공식 접수·성능·운영 readiness의 PASS로 확대하지 않는다. M-01 기능의 dev 통합 완료와 RELEASED를 구분한다.

M-01 종료 후 M-02 준비 사항과 필요한 계정 정책 결정 묶음을 제안한다. 이 세션에서 M-02 구현까지 자동 확장하지 않는다.
