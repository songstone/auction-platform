# JPA 구조·적용 계획 반영 검토 — 2026-10-16

## 범위

입력 dev: `915f495d60e1238cfbe12c3ccfaf804bf3b65622`. 작업 브랜치: `docs/jpa-entity-plan`. 사용자 엔티티·도메인 통합/Spring Data Repository 지시와 후속 문서 수정 요청을 D-096·ADR-006으로 기록했다.

이번 변경은 설계·계획·기준선 검사이며 실제 JPA 의존성·엔티티·Repository·DB migration은 추가하지 않았다. JPA 기반 전환은 JPA-10/20, 첫 업무 쓰기는 M-02 정책·계약 확정 뒤 JPA-30이다. BIGINT PK/외부 ID 분리·데이터 보존·동적 조건/복잡 SQL 대응·트랜잭션 검증을 구체 작업으로 남겼다.

## 변경과 검토

- SYSTEM-DESIGN 1.1 / DOMAIN-MODEL 1.3 / DECISION-LOG 1.9. JPA 매핑을 domain에 허용하고 같은 기능 application의 Spring Data Repository를 서비스가 직접 사용하도록 지정했다.
- 별도 영속 모델·매퍼·단순 CRUD 저장 포트/위임 어댑터를 기본으로 만들지 않는다. HTTP DTO·기능 간 publicapi·명시 SQL/외부 협력의 의미 있는 경계는 유지한다.
- 계약 0.1.0의 OpenAPI·이벤트 bytes, 제품 정책·INV·업무 원자성·남은 OPEN은 보존한다. 현재 query JDBC 경로·정확 ID·정렬·cursor를 JPA 구조 변경으로 바꾸지 않는다.
- D-095 sealed manifest를 원문 그대로 보존하고 D-096의 아키텍처 1.1 새 manifest를 추가했다. 검사기는 새 manifest와 선행 manifest를 각각 고정 hash로 검사한다. 과거 승인 결과·실행 보고서는 덮어쓰지 않는다.
- mutation 검사에 선행 manifest 훼손과 새 ADR 변경 사례를 추가했다. 이 검사는 파일 무결성 증거이며 승인 절차 전체의 기술적 강제나 JPA runtime 정확성 증거는 아니다.

검토는 이번 작업자의 문서 교차 검토다. 별도 BE/FE/QA 에이전트의 독립 검토를 수행했다고 주장하지 않는다.

## 검증과 미실행

명령별 최종 결과와 정확 검증 SHA·CI·dev 통합은 아래에 기록한다. 원시 정적 결과는 `.artifacts/jpa-plan/`에 저장한다.

| 검사 | 결과 |
| --- | --- |
| `python scripts/check-approved-baseline.py --strict-evidence` | PASS — 21개 파일, 이전 manifest 원문 보존 |
| `python scripts/test-baseline-guard.py` | PASS — 7건 |
| `.venv/Scripts/python.exe -X utf8 scripts/verify-contracts.py --output .artifacts/jpa-plan/contracts.json` | PASS — 41 paths·45 operations·91 schemas·24 positive/38 negative examples |
| 변경 Markdown의 UTF-8·로컬 링크/앵커·표·후행 공백 / `git diff --check` | PASS — Markdown 17개·로컬 링크 254개·앵커 3개·표 116개 |
| CI contracts/backend/frontend/integration | PENDING |
| 실제 JPA 저장·BIGINT 전환·JPA/JDBC transaction·검색 성능 | NOT_RUN — 후속 구현 범위 |
| 새 계정·입찰·SSE·장애/시간/성능·운영 인수 | NOT_RUN — 이번 문서 변경으로 완료하지 않음 |

Git 검증·통합 commit과 CI는 이력 보존을 위해 후속 완료 기록으로 추가한다. 보고서 자신의 최종 commit은 자체 문서에 선기록하지 않는다.
