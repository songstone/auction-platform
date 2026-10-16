# Auction Platform

최대 4개 레인이 독립 진행하는 실시간 경매 MVP다. 현재는 **공개 회차 목록·다음 페이지 → 상세 → 목록 복귀**를 PostgreSQL → REST API → React 화면까지 연결했다. DB 장애 후 같은 열린 화면의 재시도 복구도 검증했다. 출품·입찰·자동 경매·회원 인증·SSE는 후속 작업이다.

| 원본 | 내용 |
| --- | --- |
| [제품 요구사항](docs/product/MVP-PRD.md) | 승인 요구사항과 인수 조건 |
| [시스템 설계](docs/architecture/SYSTEM-DESIGN.md) | 채택한 모듈·트랜잭션·복구 구조 |
| [계약 안내](contracts/README.md) | 계약 0.1.0·OPEN·변경 절차·승인 범위 |
| [현재 상태](docs/STATE.md) | 구현·검증 근거와 리드가 관리하는 작업 상태 |
| [전체 MVP 로드맵](docs/ROADMAP.md) | 승인 완료: 7개 마일스톤·사용자 흐름·완료 조건·의존성·위험·시작 조건 |
| [Epic·Feature 백로그](docs/BACKLOG.md) | 승인 완료: 전체 요구사항·제외 범위·통합 시나리오 추적 |
| [M-02 리드 컨텍스트](docs/handoffs/M-02-LEAD-CONTEXT.md) | 다음 세션 진입점: M-01 완료 근거·남은 계정 정책·계약·착수/통합·인수 조건 |
| [M-02 인계 문서 검토](docs/implementation/M-02-HANDOFF-REVIEW-2026-10-16.md) | 현재 문서 검사와 M-02 미실행 범위 |
| [M-01 리드 인계 이력](docs/handoffs/M-01-LEAD-CONTEXT.md) | 당시 승인 범위·착수 확인·배정/통합 조건과 [문서 검토](docs/implementation/M-01-HANDOFF-REVIEW-2026-10-16.md) |
| [전체 로드맵 검토 기록](docs/implementation/ROADMAP-REVIEW-2026-10-16.md) | 문서 범위의 검사·독립 검토·미실행 경계 |
| [M-01 작업 기록](docs/tasks/README.md) | 실제 착수·소유권·검증·dev 통합 기록 |
| [M-01 작업 분해 검토 이력](docs/implementation/MILESTONE-PLANNING-REVIEW-2026-10-16.md) | 기존 최소 흐름 계획의 정적 검사·독립 리뷰·미실행 경계 |
| [작업 계획](docs/implementation/IMPLEMENTATION-PLAN.md) | BE·FE·QA 작업 카드와 의존성 |
| [QA 계획](docs/implementation/QA-PLAN.md) | 검증 종류와 실제 증거의 구분 |
| [초기 골격 실행 이력](docs/implementation/FOUNDATION-VERIFICATION.md) | 최초 Maven 골격의 실행·미실행 범위 |
| [Gradle 전환 실행 이력](docs/implementation/GRADLE-MIGRATION-VERIFICATION.md) | Spring Boot 3.5.16에서 수행한 빌드 도구 전환의 실행·미실행 범위 |
| [Spring Boot 4 전환 검증](docs/implementation/BOOT4-MIGRATION-VERIFICATION.md) | 현재 백엔드 기준인 Corretto 25·Spring Boot 4.1.1·Gradle 9.8.1의 실행·미실행 범위 |
| [로컬 Compose 실행 검증](docs/implementation/NATIVE-COMPOSE-VERIFICATION.md) | Spring Boot 기본 Docker Compose 연동의 실행·미실행 범위 |
| [현재 M-01 탐색 검증](docs/implementation/ROUND-DISCOVERY-VERIFICATION.md) | 목록·상세·동일 화면 복구, 정확 SHA·CI·실패/정리·NOT_RUN |
| [기존 공개 회차 상세 검증](docs/implementation/PUBLIC-ROUND-VERIFICATION.md) | 당시 상세 조회의 실행 이력 |
| [공통 구현 지침](AGENTS.md) | 공유 파일 소유권·마이그레이션·계약·검증 규칙 |

## 브랜치 운영

| 브랜치 | 역할 |
| --- | --- |
| `main` | 사용자가 주기적으로 `dev`를 병합하는 기준 브랜치 |
| `dev` | 검증된 작업을 모으는 개발 통합 브랜치 |
| `feat/*`, `fix/*`, `chore/*`, `docs/*` | 최신 `dev`에서 분기하는 작업 브랜치. 통합 완료 후 삭제 |

1. 최신 `origin/dev`에서 작업 브랜치를 만든다.
2. 변경에 필요한 검사와 CI를 통과시킨 뒤 `dev`에 병합·푸시한다. 병합 충돌을 해결하며 코드가 바뀌면 관련 검사를 다시 수행한다.
3. 원격 `dev`에 로컬·원격 작업 브랜치의 커밋이 모두 포함됐는지 확인한 후 두 작업 브랜치를 삭제하고 `dev`로 돌아온다. 미병합 커밋이나 다른 worktree에서 사용 중인 브랜치는 보존한다.
4. `main` 반영은 사용자가 원하는 시점에 수행한다. 에이전트의 일반 작업 완료 범위는 `dev` 통합과 작업 브랜치 정리까지다.

`main`과 `dev`는 계속 유지한다. 최초 `dev`는 기존 `main`의 `003a28f`에서 생성했다. 과거 검증 보고서에 기록된 `main` 병합 이력은 당시 실행 기록이며 현재 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다. 기존 CI는 모든 push/PR에 실행되므로 `dev`도 검사한다.

## 로컬 실행

백엔드는 Amazon Corretto 25와 Docker Desktop을 사용한다. 최초 한 번 [backend/.env.example](backend/.env.example)을 `backend/.env`로 복사하고 `POSTGRES_PASSWORD`에 로컬 DB 비밀번호를 지정한다. 기존 `.env`가 있으면 그대로 사용한다.

```powershell
# 저장소 루트에서 시작
Set-Location backend
$env:JAVA_HOME = 'C:\path\to\jdk-25'
.\gradlew.bat bootRun --args='--spring.profiles.active=local-infra'
```

Spring Boot가 [backend/compose.yaml](backend/compose.yaml)의 PostgreSQL·Mailpit을 시작하고 DB 연결 정보를 자동으로 적용한다. 백엔드는 `http://localhost:8080`에서 실행된다. IntelliJ 실행 설정은 [백엔드 안내](backend/README.md)를 따른다.

```powershell
# 별도 터미널, 저장소 루트에서: 백엔드 기동 후 개발용 예제 회차 추가
pwsh -NoProfile -File infra/seed-demo.ps1

# 프런트엔드: http://localhost:5173/
Set-Location frontend
npm ci
npm run dev
```

백엔드를 종료해도 개발 서비스는 유지된다. 모두 중지하려면 `backend`에서 `docker compose stop`을 실행한다. DB 데이터는 보존된다. 예제 회차는 [infra/fixtures](infra/README.md)의 합성 데이터이며 자동으로 생성되지 않는다.

검증에는 Node/npm([지원 버전](frontend/package.json)), Python 3.12 이상, PowerShell 7도 필요하다. 저장소 루트에서 실행한다.

```powershell
pwsh -NoProfile -File scripts/verify.ps1 -JavaHome 'C:\path\to\jdk-25'
# 별도 임시 DB·HTTP·Chromium 통합 검증. Docker 필요.
pwsh -NoProfile -File scripts/verify.ps1 -JavaHome 'C:\path\to\jdk-25' -Integration
```

기본 프로필은 DB 없이 실행하고 회차 조회에 503을 반환한다. 로컬 DB 조회에는 `local-infra` 프로필을 사용한다. 프런트엔드 화면은 [frontend/README](frontend/README.md)를 따른다. health와 조회 성공은 입찰·실제 인증 세션·운영 readiness의 증거가 아니다.

## 공통 계약 보호

```powershell
python -X utf8 scripts/check-approved-baseline.py --strict-evidence
```

승인 manifest와 공식 문서의 바이트 hash를 확인한다. `.gitattributes`는 보호 대상의 checkout 줄끝 변환을 막는다. 추가 계약 정적 검사는 기존 검사기를 임시 복사본에서 실행하고 `.artifacts/`에 결과를 남겨 승인 당시 보고서를 보존한다.

구현자가 공유 계약·승인 기록을 임의 수정하지 않는다. 변경은 [ADR-005](docs/decisions/adr/ADR-005-CONTRACT-BASELINE.md)에 따라 영향·예제·호환성·사용자 승인을 기록한다. 로컬/CI 검사는 저장소의 보호 브랜치·필수 리뷰 설정을 대신하지 않는다. GitHub Actions 구성의 원격 실행과 브랜치 보호 적용 여부는 검증 결과에서 따로 기록한다.
