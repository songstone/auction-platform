# 전체 MVP 로드맵 문서 검토 기록

- 작성일: 2026-10-16. 책임: Project Planning Lead.
- 조사 기준: `a8d4df69c891f0f55fd017f20a2f427f27367de6`. fetch 후 `dev = origin/dev`, 최초 clean. `main = origin/main = 003a28fb9f2836f80ce21ed4e64f855977632eb8`.
- 작업 브랜치: `docs/mvp-roadmap`, 최신 origin/dev에서 생성. 문서 DRAFT를 보관하는 작업이며 로드맵 승인·구현 착수는 별도다.
- 산출물: [ROADMAP](../ROADMAP.md), [BACKLOG](../BACKLOG.md), README/STATE/IMPLEMENTATION-PLAN/M-01 안내의 현재 문서 링크.
- 변경 범위: 문서만. 제품 코드·시험·빌드·CI·승인된 제품/구조/결정/계약 원본은 변경하지 않는다. 과거 검증 보고서는 보존한다.
- 승인 상태: **DRAFT / 사용자 승인 대기**. 승인 후 작성할 별도 M-01 실행 리드 컨텍스트는 아직 생성하지 않았다.

## 조사와 검토 범위

PRD/AUCTION-RULES/DOMAIN-MODEL/SYSTEM-DESIGN, 현행 결정과 ADR, 공통 계약·deferred 표면, 현재 소스/시험 inventory, 구현 계획/QA/STATE/T-001~004, 과거 실행 보고서를 대조했다. 독립 분석 역할 3명이 요구사항 추적, 구조·위험, 실제 구현 상태를 각각 읽기 전용으로 조사하고 문서 초안을 재검토했다. 구현 에이전트 실행 수는 0명이다.

현재 전체 기준은 53개 G/R 요구사항, 10개 제외 범위, 고유 AC 136개, SC 10개다. 공개 회차 상세 이외 기능의 현재 제품 실행 성공을 주장하지 않는다. 과거 실험의 기술 미채택 상태는 D-095 이전 기록이므로 현재 채택 상태로 사용하지 않았다.

## 실행 명령과 결과

| 검증 | 결과 | 범위 |
| --- | --- | --- |
| 승인 원본 strict-evidence | PASS | 계약 0.1.0, 보호 대상 20개. 해시 일치이며 업무 실행 증거 아님 |
| 문서/추적 검사 | DOCUMENT_STRUCTURE_ONLY / PASS | 문서 7개, 로컬 링크/앵커 117개, 53 G/R·10 EX·원본 136 AC·10 SC·9 Epic·26 Feature·7 마일스톤. 의존성 간선 30개에 cycle 없음, UTF-8/표 구조 확인 |
| 계약 정적 검사 | CONTRACT_STATIC_ONLY / PASS | 기존 검사기를 임시 복사본에서 실행: 41 paths/45 operations/91 schemas. 승인 당시 evidence 보존 |
| 독립 리뷰 | PASS | 읽기 전용 검토 3명. 의존성/세션/불명 보류 수정 후 구조·위험 검토자가 재확인. 사용자 승인을 대체하지 않음 |
| 문서 후보 CI | 실행 전 | 실제 후보 SHA로 실행 후 결과를 최종 인계에 보고 |
| 로컬 앱·DB·브라우저·부하·장애 재실행 | NOT_RUN | 문서 작업. CI의 기존 시험도 새 MVP 기능의 검증이 아님 |
| 신규 MVP 기능·운영 배포 | NOT_RUN | 코드 구현·배포를 수행하지 않음 |

```powershell
git fetch origin --prune
git status --short --branch
git rev-parse HEAD origin/dev origin/main
git worktree list
python -X utf8 scripts/check-approved-baseline.py --strict-evidence
& '.\.venv\Scripts\python.exe' -X utf8 scripts/verify-contracts.py --output .artifacts/planning/20261016-mvp-roadmap/contract-validation-report.json
git diff --check
```

문서 구조/추적성은 일회성 검사로 확인하며 원시 결과 위치는 `.artifacts/planning/20261016-mvp-roadmap/document-check.json`이다. 이 검사는 링크·ID·표 구조만 확인하고 정책 의미·Mermaid 실제 렌더링·제품 동작을 증명하지 않는다. 정책 의미와 의존성은 별도 독립 리뷰로 대조한다. Mermaid 실제 렌더링은 NOT_RUN이다.

검증 후보 SHA, CI URL/각 job 결과, 통합 dev SHA, 원격 포함·branch 정리는 세션 최종 인계에 실제 값으로 보고한다. 보고서 자체의 commit을 미리 예측해 적지 않는다. 문서의 origin/dev 조사 SHA를 검증/미래 구현 SHA로 바꾸어 쓰지 않는다.

## 독립 리뷰에서 반영한 수정

1. 공개 확정과 출품/배정, 공식 판정과 원판정/ACK는 함께 완성하는 기능이므로 DAG에서 통합 노드로 묶었다. 일부 선행만 필요한 노드는 부분 범위를 명시했다.
2. M-02는 실제 세션·행위자·역할/보안 경계를 검증하며 아직 없는 출품·입찰·연락처 API의 권한은 해당 기능 통합 때 검증하도록 분리했다.
3. M-04는 개인 응답/commit 응답 불명과 서비스 접수 연속성·권위 기록/효과 불명을 구별했다. 개인 미확인만으로 전체 레인 보류를 추가하지 않는다.
4. M-01의 기존 공유 파일 소유권/인계를 유지하고 dev merge 뒤 push·포함 관계·안전한 branch 정리를 명시했다.

## 남은 판단

전체 로드맵과 M-01 범위에 대한 사용자 승인이 필요하다. 이는 이번 사용자의 명시 요청이다. CR-04~10/SEC의 후보값, deferred 표면 변경, 실제 위험 검증 성공·전체 MVP 구현·운영 배포는 로드맵 승인에 포함되지 않는다. 문서가 dev에 통합되더라도 모든 구현 카드는 승인 기록과 실제 시작 조건 충족 전 DRAFT로 유지한다.
