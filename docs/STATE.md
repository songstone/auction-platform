# 현재 상태와 다음 마일스톤

2026-10-16, Engineering Lead. **M-01 공개 회차 탐색 기능은 검증 PASS / 원격 dev 통합 완료**다. 목록·페이지 탐색·상세·복귀·빈 목록/오류 구분·동일 열린 오류 화면의 DB 복귀 후 재시도를 확인했다. 정확 실행·실패 이력·CI·원시 증거는 [ROUND-DISCOVERY-VERIFICATION](implementation/ROUND-DISCOVERY-VERIFICATION.md)에 있다. RELEASED 판정은 하지 않았다.

## 승인·기준선

[ROADMAP](ROADMAP.md)과 [BACKLOG](BACKLOG.md)의 7개 마일스톤 및 첫 M-01 범위는 2026-10-16 사용자 “승인”으로 승인됐다. 승인 대상 제안은 `49bec92cc33e8a61dc5fa5d3f6c7c84432f78d7d`다. 실제 구현 착수 origin/dev는 `fa4dac5c106cb114c1919aec2bdc6021f79f1958`이며 과거 조사 SHA와 구별한다. [당시 인계](handoffs/M-01-LEAD-CONTEXT.md)·[계획 검토](implementation/MILESTONE-PLANNING-REVIEW-2026-10-16.md)·[인계 검토](implementation/M-01-HANDOFF-REVIEW-2026-10-16.md)는 역사로 보존한다.

입력은 제품 1.6 / DOMAIN 1.2 / SYSTEM 1.0 / DECISION 1.8 / 계획·QA 0.5 / 계약 0.1.0이다. 보호 파일 20개 strict-evidence PASS, 승인 원본과 manifest 불변. 현재 계획·QA 0.6은 실행 안내를 갱신한 문서이며 새로운 정책 승인이 아니다.

## 작업 현황

제품 구현 활성 **0/2**, T-004 리드 문서 마감 중. T-001~003은 독립 리뷰·명령·각 후보 4개 CI 성공을 확인한 뒤 순서대로 dev에 FF/push했다.

| 작업 | 담당 | 상태 | 실제 시작 SHA | 검증 / dev 통합 SHA |
| --- | --- | --- | --- | --- |
| [T-001](tasks/T-001.md) 목록 API | BE A `/root/be` | MERGED | `fa4dac5c106cb114c1919aec2bdc6021f79f1958` | `658a486c1b5bc68e0cc32e92de34f1fe3234061f` / 동일 |
| [T-002](tasks/T-002.md) 목록·상세 UI | FE B `/root/fe` | MERGED | `fa4dac5c106cb114c1919aec2bdc6021f79f1958` | `2720ed4a6cfa84608f842f3b709002ccf5204fc2` / 동일 |
| [T-003](tasks/T-003.md) 독립 통합 검증 | QA C `/root/qa` | MERGED | `2720ed4a6cfa84608f842f3b709002ccf5204fc2` | `89ae78c368a65522f4357616f9eebfaa89dcf084` / 동일 |
| [T-004](tasks/T-004.md) 인수·문서 | Lead `/root` | IN_REVIEW — 문서 최종 CI/통합 전 | `89ae78c368a65522f4357616f9eebfaa89dcf084` | 아래 최종 인계 기록으로 확정 |

문서 커밋은 자기 최종 SHA·통합 결과를 선행 사실로 쓸 수 없으므로 T-004 최종 상태는 통합 후 `.artifacts/tasks/m01-lead/final-handoff.json` 및 사용자 최종 응답에 기록한다. 이 문서의 IN_REVIEW는 작성 시점 상태다. 문서가 remote dev에 포함됐는지와 해당 SHA CI를 확인하여 최종 마감을 판정한다.

## 실제 확인된 범위

- 실제 BE PostgreSQL/HTTP 15건, BE fast 13건, FE unit 33건 PASS.
- 독립 목록 HTTP expectation 39건 + 기존 상세 6건 PASS.
- Chromium 156.0.8078.4, 1280×844/390×844: 실제 서버 브라우저 15건 + 합성 fault 7건 PASS. 총 22건, skip/flaky 0.
- 실제 공개 53개·3페이지, 정확 ID/큰 counter/시각, 빈 목록·503 구별, 같은 Page/document를 유지한 DB down/up 재시도 PASS.
- runtime cleanup·fixture 배포 제외·이번 주입 비밀 scan PASS. 작업 원시 증거는 루트 checkout으로 복사하고 hash 대조했다.
- T-001~003 로컬/원격 branch 및 Git worktree 등록 제거 완료. T-001 디스크 잔여 폴더는 긴 경로 오류와 자동 삭제 승인 거부로 보존했다. 상세는 보고서와 cleanup JSON 참조.

기존 [공개 상세 보고서](implementation/PUBLIC-ROUND-VERIFICATION.md)의 새 페이지 복구는 당시 관측이다. 현재 동일 화면 복구는 새 M-01 보고서의 별도 증거다. 어느 것도 인증 세션·입찰·SSE·공식 접수·성능·운영 인수를 대신하지 않는다.

main/origin/main은 `003a28fb9f2836f80ce21ed4e64f855977632eb8`로 유지했다. M-01 구현은 dev에만 통합했고 배포하지 않았다. 전체 R-37/R-47/R-49, OPEN-08 지원 환경, 인증·출품·입찰·자동 진행·SSE·성능·운영은 NOT_RUN/후속 범위다.

## 상태 전이와 다음 준비

`DRAFT → READY → IN_PROGRESS → IN_REVIEW → VERIFIED → MERGED → RELEASED`

READY는 실제 최신 origin/dev 40자리 SHA·계약/guard·담당/worktree·파일 소유권·선행 통합을 리드가 확인한 상태다. VERIFIED는 독립 리뷰와 해당 커밋 검증 완료, MERGED는 필수 CI 후 원격 dev 포함 확인, RELEASED는 별도 승인과 배포 확인이 있는 상태다. BLOCKED에는 원인·소유자·재개 조건을 기록한다. NOT_RUN은 실행 증거 상태이며 승인 여부와 다르다.

다음 M-02는 **정책 준비만** 인계한다. 이메일 동일성/중복·검증과 운영 계정, 비밀번호·토큰 수명/일회성/동시성/무효화, 세션·메일/시도 제한·계정 유무 비노출을 작은 결정 묶음으로 정리한다. CR-10/SEC 제안 수치는 미승인으로 유지한다. 결정 후 Contract Owner의 ADR-005 변경안과 별도 작업 카드를 마련한다. 이번 세션에서 M-02를 구현하거나 READY로 올리지 않는다.
