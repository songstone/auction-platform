# M-01 작업 분해 문서 검토 기록

- 일자: 2026-10-16. 책임: Engineering Lead.
- 조사 기준: `e5ebde892395c02bae9f4e604b610a4bf7088ee0`, fetch 확인 시 `dev = origin/dev`, clean.
- 문서 검토 대상 커밋: `22b4b786c2748e2b36684b8c7e241934d8d77abd` (`docs/public-discovery-plan`). 정적 명령은 이 커밋과 동일한 문서 작업 트리에서 커밋 직전에 실행했다.
- 추가 변경: 이 검토 기록과 현재 가이드 링크. 제품 코드·시험·빌드·CI·승인 원본 변경 없음.
- 산출물: [STATE](../STATE.md), [마일스톤/DAG/배정·충돌 분석](../tasks/README.md), T-001~004 작업지시서. 모두 구현 **DRAFT**다.

## 이번에 확인한 결과

| 증거 | 결과 | 범위 |
| --- | --- | --- |
| 승인 원본 무결성 | PASS | strict-evidence, 보호 파일 20개, 계약 0.1.0 |
| 승인 guard 반례 | PASS, 5개 | 변경 원본·manifest 대체·과거 evidence 구별 등 기존 검사 |
| 계약 정적 검사 | CONTRACT_STATIC_ONLY / PASS | 기존 41 paths/45 operations/91 schemas, 원본을 임시 복사하여 검사 |
| 문서 구조 | DOCUMENT_STRUCTURE_ONLY / PASS | 대상 Markdown 9개, 로컬 링크/앵커 102개, 표 열·UTF-8 확인, 카드 4개 × 필수 15항목 |
| 독립 문서 리뷰 | PASS | 정책/계약 검토자와 구현·증거 검토자 2명. 구현 실행·사용자 범위 승인이 아님 |
| 공백 검사 | PASS | `git diff --check`, `git diff --cached --check` |
| 조사 기준의 원격 CI | SUCCESS, API 조회 확인 | [Actions 38840794281](https://github.com/songstone/auction-platform/actions/runs/38840794281), e5ebde8의 contracts/backend/frontend/integration 모두 success |
| 이 세션의 로컬 앱·DB·브라우저 재실행 | NOT_RUN | 문서 변경에 대한 로컬 검토. 기존 공개 상세의 실제 실행 증거는 [과거 보고서](PUBLIC-ROUND-VERIFICATION.md)에 보존 |
| M-01 목록·인증·입찰·SSE 구현/검증 | NOT_RUN | 구현자 실행 0명. 분석 에이전트는 읽기 전용 조사/문서 검토만 수행 |

## 명령과 산출물

문서 작업 worktree 루트에서 실행했다. 계약 도구는 기존 루트 checkout의 전용 가상환경을 재사용했으며 제품 실행 환경은 바꾸지 않았다.

```powershell
git fetch origin --prune
git status --short --branch
git branch -vv
git worktree list
git rev-parse HEAD origin/dev origin/main
python -X utf8 scripts/check-approved-baseline.py --strict-evidence
python -X utf8 scripts/test-baseline-guard.py
& 'C:\Users\jitin81\Documents\dev\private\auction-platform\.venv\Scripts\python.exe' -X utf8 scripts/verify-contracts.py
git diff --check
git diff --cached --check
```

문서 구조는 일회성 inline Python으로 로컬 링크/Markdown heading anchor 존재, 표 열 수, UTF-8 replacement character 부재, 카드별 필수 필드·DRAFT·미배정 표기를 검사했다. 원시 결과는 `.artifacts/planning/20261016-m01-proposal/document-check.json`, 정적 계약 결과는 같은 디렉터리의 `contract-validation-report.json`에 보존한다. 작업 worktree 정리 전에 루트 checkout의 해당 경로로 복사한다. CI는 문서 최종 후보 SHA로 별도 실행하며 **검증 SHA·통합 dev SHA·최종 CI URL·정리 결과는 세션 최종 인계에 보고**한다. 이 기록 시점의 조사 CI를 문서 최종 후보의 CI로 재사용하지 않는다.

## 검토 중 수정과 남은 경계

1. portable 통합 실행기는 전체 정적 계약 검사를 자동 수행하지 않으므로 T-003에 baseline guard/contract 별도 명령을 추가했다.
2. 현재 disposable runner에 수동 관측 대기 기능이 없으므로 T-002는 기존 E2E에 실제 목록→상세→복귀 smoke를 추가하는 방식으로 구체화했다.
3. T-003의 잘못된 응답 검사는 합성 fault/mock 증거로 분리했다. 실제 DB/HTTP 검증과 합산하지 않는다.

초기 도구 확인에서 `gh`가 PATH에 없어 실행되지 않았다. 현재 CI는 GitHub REST API의 actions/runs와 jobs를 읽어 확인했다. 구현·검증 실패를 숨긴 것이 아니며 앱/CI 코드 수정도 없었다. 최초 조사에서 STATE/tasks가 없음을 확인해 새로 작성했다.

다음 구현 시작에는 사용자 범위 승인, 실제 최신 origin/dev SHA·선행 통합 SHA·계약 0.1.0의 기록, 독립 worktree와 파일 소유권 확인이 필요하다. 기존 공개 상세·실험·정적 계약 증거를 새 목록 또는 전체 경매 인수 성공으로 확대하지 않는다. OPEN-08 전체 지원환경·OPEN-06 인증 정책·실제 배포/릴리스는 별도 결정으로 유지한다.
