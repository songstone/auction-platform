# Auction Platform

최대 4개 레인이 독립 진행하는 실시간 경매 MVP다. 현재는 **공개 회차 조회**를 PostgreSQL → REST API → React 화면까지 연결했다. 출품·입찰·자동 경매·회원 인증·SSE는 후속 작업이다.

| 원본 | 내용 |
| --- | --- |
| [제품 요구사항](docs/product/MVP-PRD.md) | 승인 요구사항과 인수 조건 |
| [시스템 설계](docs/architecture/SYSTEM-DESIGN.md) | 채택한 모듈·트랜잭션·복구 구조 |
| [계약 안내](contracts/README.md) | 계약 0.1.0·OPEN·변경 절차·승인 범위 |
| [작업 계획](docs/implementation/IMPLEMENTATION-PLAN.md) | BE·FE·QA 작업 카드와 의존성 |
| [QA 계획](docs/implementation/QA-PLAN.md) | 검증 종류와 실제 증거의 구분 |
| [초기 골격 실행 이력](docs/implementation/FOUNDATION-VERIFICATION.md) | 최초 Maven 골격의 실행·미실행 범위 |
| [Gradle 전환 실행 이력](docs/implementation/GRADLE-MIGRATION-VERIFICATION.md) | Spring Boot 3.5.16에서 수행한 빌드 도구 전환의 실행·미실행 범위 |
| [Spring Boot 4 전환 검증](docs/implementation/BOOT4-MIGRATION-VERIFICATION.md) | 현재 백엔드 기준인 Corretto 25·Spring Boot 4.1.1·Gradle 9.8.1의 실행·미실행 범위 |
| [공개 회차 조회 검증](docs/implementation/PUBLIC-ROUND-VERIFICATION.md) | DB·API·브라우저·장애/복구와 CI 실행 증거 |
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

Amazon Corretto 25, Node/npm([frontend/package.json](frontend/package.json)의 engines), Python 3.12 이상과 PowerShell 7을 사용한다. 백엔드는 Spring Boot 4.1.1이며 Gradle 9.8.1을 저장소 Wrapper로 고정한다. Docker는 로컬 DB·메일을 사용할 때 필요하다. 전역 `java`가 다른 버전이면 `AUCTION_JAVA_HOME` 또는 `-JavaHome`으로 Corretto 25 설치 위치를 지정한다. 현재 전환의 선택 이유·호환 범위·실행 결과는 [Spring Boot 4 전환 검증](docs/implementation/BOOT4-MIGRATION-VERIFICATION.md)을 따른다.

```powershell
# 계약·백엔드·프런트엔드 골격 검증
pwsh -NoProfile -File scripts/verify.ps1 -JavaHome 'C:\path\to\jdk-25'

# Docker를 사용하는 실제 DB/HTTP/Chromium 통합 검증 (개발 DB와 분리)
pwsh -NoProfile -File scripts/verify.ps1 -JavaHome 'C:\path\to\jdk-25' -Integration

# 필요할 때 개발 DB·메일 준비/기동
pwsh -NoProfile -File infra/up.ps1

# 빌드한 백엔드 실행. DB 연결은 -WithInfrastructure를 지정할 때만 활성화
pwsh -NoProfile -File scripts/run-backend.ps1 -JavaHome 'C:\path\to\jdk-25'
pwsh -NoProfile -File scripts/run-backend.ps1 -JavaHome 'C:\path\to\jdk-25' -WithInfrastructure

# 별도 터미널: 백엔드 기동/마이그레이션 완료 후 개발용 예제 회차 추가
pwsh -NoProfile -File infra/seed-demo.ps1

# 별도 터미널: http://localhost:5173/?roundId=demo-round
Set-Location frontend
npm ci
npm run dev

# 개발 DB·메일 중지, 데이터 보존
Set-Location ..
pwsh -NoProfile -File infra/stop.ps1
```

위 명령은 저장소 루트에서 시작하며 서비스는 별도 터미널로 실행한다. `infra/stop.ps1`도 루트에서 실행한다. 예제 회차는 2099년 일정의 합성 데이터다. 시각으로 공개 여부를 추정하지 않고 DB에 기록된 실제 공개 여부를 사용한다. 기본 프로필은 health만 기동 가능하며 회차 조회에는 503을 반환한다. DB 조회에는 `-WithInfrastructure`가 필요하다.

백엔드 실행은 [backend/README](backend/README.md), 프런트엔드 화면은 [frontend/README](frontend/README.md), DB·메일·사진 경로는 [infra/README](infra/README.md)를 따른다. 공개 GET은 익명 접근을 허용하며 그 외 업무 경로는 기본 거부한다. health와 조회 성공은 입찰·실제 인증 세션·운영 readiness의 증거가 아니다.

## 공통 계약 보호

```powershell
python -X utf8 scripts/check-approved-baseline.py --strict-evidence
```

승인 manifest와 공식 문서의 바이트 hash를 확인한다. `.gitattributes`는 보호 대상의 checkout 줄끝 변환을 막는다. 추가 계약 정적 검사는 기존 검사기를 임시 복사본에서 실행하고 `.artifacts/`에 결과를 남겨 승인 당시 보고서를 보존한다.

구현자가 공유 계약·승인 기록을 임의 수정하지 않는다. 변경은 [ADR-005](docs/decisions/adr/ADR-005-CONTRACT-BASELINE.md)에 따라 영향·예제·호환성·사용자 승인을 기록한다. 로컬/CI 검사는 저장소의 보호 브랜치·필수 리뷰 설정을 대신하지 않는다. GitHub Actions 구성의 원격 실행과 브랜치 보호 적용 여부는 검증 결과에서 따로 기록한다.
