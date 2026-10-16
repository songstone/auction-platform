# 현재 상태와 다음 마일스톤

- 관리 책임: Engineering Lead. 구현자는 결과를 제출하고 리드만 상태를 갱신한다.
- 확인일: 2026-10-16. 이 문서는 실행 현황과 작업 승인 상태를 관리한다. 제품·설계·계약의 원본을 대체하지 않는다.
- 최초 조사 기준: `e5ebde892395c02bae9f4e604b610a4bf7088ee0` (`dev = origin/dev`, fetch 확인, clean). `main = origin/main = 003a28fb9f2836f80ce21ed4e64f855977632eb8`.

## 확인된 현재 범위

| 대상 | 확인 상태 | 증거와 한계 |
| --- | --- | --- |
| 승인 기준선 | BASELINE_INTEGRITY / PASS | 계약 0.1.0, 보호 파일 20개. 이번 조사에서 `python scripts/check-approved-baseline.py --strict-evidence` 실행 |
| 공개 회차 상세 | 구현·통합 이력 확인 | `/?roundId=<ID>` → 공개 GET → PostgreSQL → React. 구현 커밋 `39fb9e147c6e9b04dc5f763f164b6e2c349c4dca`, [실행 원본](implementation/PUBLIC-ROUND-VERIFICATION.md) |
| 조사 기준 커밋 CI | SUCCESS, 원격 조회 확인 | [Actions 38840794281](https://github.com/songstone/auction-platform/actions/runs/38840794281), head `e5ebde892395c02bae9f4e604b610a4bf7088ee0`. contracts/backend/frontend/integration 모두 success. 이번 로컬에서 앱 검사를 다시 실행한 것은 아님 |
| 공개 회차 목록 | 미구현 | 승인 `listPublicRounds`는 존재하나 루트 화면은 회차 링크 안내만 제공 |
| 인증·출품·입찰·자동 진행·SSE | 미구현 / NOT_RUN | health·조회·개발 fixture·SPIKE 증거를 이 기능의 성공으로 재사용하지 않음 |
| 배포·운영 인수 | NOT_RUN | 기존 기능의 RELEASED 판정 근거 없음 |

기존 공개 조회의 장애 증거는 DB 중단과 재시작 후 **새 조회**다. 열린 오류 화면의 성공 재시도, 인증 세션·입찰 원기록·SSE 복구를 입증한 것은 아니다. 과거 보고서의 `main` 통합 문구는 당시 이력이며 이후 작업은 [AGENTS.md](../AGENTS.md)의 `dev` 통합 절차를 따른다.

## 제안 마일스톤 M-01

**비회원이 첫 화면에서 공개 회차 목록을 탐색하고 선택한 회차의 공개 상세를 확인한다.**

상태: **DRAFT — 제품 책임자의 작업 범위 승인 전**. 구현 에이전트 활성 수 **0/2**. 이번 세션의 독립 에이전트 2명은 읽기 전용 현황·정책 검토만 수행했다. 아래 담당은 역할 배정안이며 실제 구현자 실행·브랜치/worktree 생성 보고가 아니다.

범위·의존성·충돌·인수 기준은 [M-01 작업 운영안](tasks/README.md)에 있다. 기존 [IMPLEMENTATION-PLAN](implementation/IMPLEMENTATION-PLAN.md)의 BE-50/FE-20/QA-10/INT-10 중 공개 회차 탐색 부분을 작은 작업으로 구체화한다. 기존 광범위 카드 전체를 완료 처리하지 않는다.

| 작업 | 책임 역할 | 상태 | 실제 시작 커밋 | 검증 커밋 / 통합 커밋 |
| --- | --- | --- | --- | --- |
| [T-001](tasks/T-001.md) 공개 회차 목록 API | BE 구현자 A | DRAFT | 미배정, 시작 전 | 없음 / 없음 |
| [T-002](tasks/T-002.md) 목록 탐색·상세 이동 화면 | FE 구현자 B | DRAFT | 미배정, 시작 전 | 없음 / 없음 |
| [T-003](tasks/T-003.md) 실제 탐색 흐름의 독립 통합 검증 | QA/통합 구현자 C | DRAFT | 선행 병합 후 배정 | 없음 / 없음 |
| [T-004](tasks/T-004.md) 마일스톤 검토·인수·상태 마감 | Engineering Lead | DRAFT | 선행 병합 후 배정 | 없음 / 없음 |

## 상태 전이와 착수 통제

`DRAFT → READY → IN_PROGRESS → IN_REVIEW → VERIFIED → MERGED → RELEASED`

- READY: 사용자 범위 승인, 파일 소유권, 실제 최신 `origin/dev`의 **40자리 SHA**, 계약 버전/무결성, 작업 브랜치·worktree 예약, 의존 커밋 존재/포함 관계를 리드가 확인했다. 승인 메시지와 SHA를 카드에 기록하기 전에는 실행하지 않는다.
- IN_PROGRESS: 지정 worktree에서 실제 담당자가 작업을 시작했다. 구현 에이전트는 동시 최대 2명이다.
- IN_REVIEW: 변경 커밋·실행 명령·결과·NOT_RUN·변경 파일 목록이 제출됐다.
- VERIFIED: 독립 리뷰와 해당 카드의 검증이 지정 커밋에서 통과했다. mock 증거와 실제 연동 증거를 구별한다.
- MERGED: VERIFIED 커밋의 필수 CI가 통과했고 최신 원격 `dev`에 포함됨을 확인했다. 충돌 해결 변경은 다시 검증한다.
- RELEASED: 별도 사용자 릴리스 승인과 실제 배포/확인 근거가 있다. `dev` 통합이나 `main` 승격만으로 기록하지 않는다.
- BLOCKED: 원래 상태, 막힌 이유, 필요한 결정/증거, 소유자, 재개 조건을 기록한다. 해소 후 리드가 해당 게이트를 다시 확인한다. NOT_RUN은 실행 증거 상태이며 작업 BLOCKED와 다르다.

선행 구현자의 완료 보고만으로 후속을 READY로 바꾸지 않는다. 후속 카드에는 실제 소비할 통합 커밋과 계약 버전을 직접 기록한다. 미래 커밋 SHA나 미생성 worktree를 존재하는 것처럼 기재하지 않는다.

## 다음 결정

1. M-01 범위를 공개 회차 목록 → 기존 상세로 채택하고 T-001/T-002부터 구현할지 승인 필요. 현재 요청은 최초 상태 확인과 분해안 제안이므로 아직 구현 승인이 아니다.
2. OPEN-08: 기존 Chromium desktop 1280px / mobile 390px를 이번 개발 검증 조건으로 재사용하는 안을 제안한다. 전체 PC/모바일 지원 확정과 AC-R47-01 인수는 별도다.
3. 다음 인증 마일스톤 전에 OPEN-06/CR-10/SEC의 이메일 동일성·세션/토큰·비밀번호/재설정·운영자 준비 정책을 작은 결정 묶음으로 제시한다. M-01을 막는 조건으로 확대하지 않는다.

목록의 정렬·공개 범위·커서 의미는 이미 계약에 있다. 내부 페이지 크기·커서 인코딩·SQL 계획은 BE의 구현 제안과 리뷰 대상으로 처리하며 계약에 없는 제품 제한이나 새 보안 정책을 임의 추가하지 않는다.
