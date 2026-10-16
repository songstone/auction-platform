# Auction Platform

최대 4개 레인이 독립 진행하는 실시간 경매 MVP다. 현재 구현은 **개발 골격**이며 실제 출품·입찰·자동 경매·인증·복구 기능은 후속 작업이다.

| 원본 | 내용 |
| --- | --- |
| [제품 요구사항](docs/product/MVP-PRD.md) | 승인 요구사항과 인수 조건 |
| [시스템 설계](docs/architecture/SYSTEM-DESIGN.md) | 채택한 모듈·트랜잭션·복구 구조 |
| [계약 안내](contracts/README.md) | 계약 0.1.0·OPEN·변경 절차·승인 범위 |
| [작업 계획](docs/implementation/IMPLEMENTATION-PLAN.md) | BE·FE·QA 작업 카드와 의존성 |
| [QA 계획](docs/implementation/QA-PLAN.md) | 검증 종류와 실제 증거의 구분 |
| [초기 골격 실행 이력](docs/implementation/FOUNDATION-VERIFICATION.md) | 최초 Maven 골격의 실행·미실행 범위 |
| [Gradle 전환 검증](docs/implementation/GRADLE-MIGRATION-VERIFICATION.md) | 현재 백엔드 빌드 전환의 실행·미실행 범위 |

## 로컬 실행

Java 25, Node/npm([frontend/package.json](frontend/package.json)의 engines), Python 3.12 이상과 PowerShell 7을 사용한다. Gradle은 백엔드 wrapper로 고정한다. Docker는 로컬 DB·메일을 사용할 때 필요하다. 전역 `java`가 다른 버전이면 `AUCTION_JAVA_HOME` 또는 `-JavaHome`으로 JDK 25를 지정한다. 현재 빌드 전환의 선택 이유·호환 범위·실행 결과는 [Gradle 전환 검증](docs/implementation/GRADLE-MIGRATION-VERIFICATION.md)을 따른다.

```powershell
# 계약·백엔드·프런트엔드 골격 검증
pwsh -NoProfile -File scripts/verify.ps1 -JavaHome 'C:\path\to\jdk-25'

# 필요할 때 개발 DB·메일 준비/기동
pwsh -NoProfile -File infra/up.ps1

# 빌드한 백엔드 실행. DB 연결은 -WithInfrastructure를 지정할 때만 활성화
pwsh -NoProfile -File scripts/run-backend.ps1 -JavaHome 'C:\path\to\jdk-25'
pwsh -NoProfile -File scripts/run-backend.ps1 -JavaHome 'C:\path\to\jdk-25' -WithInfrastructure

# 개발 DB·메일 중지, 데이터 보존
pwsh -NoProfile -File infra/stop.ps1
```

백엔드 실행은 [backend/README](backend/README.md), 프런트엔드 개발 미리보기는 [frontend/README](frontend/README.md), DB·메일·사진 경로는 [infra/README](infra/README.md)를 따른다. 프런트엔드의 개발용 fixture 미리보기와 백엔드의 health는 실제 경매 성공·현재 상태·운영 readiness를 뜻하지 않는다.

## 공통 계약 보호

```powershell
python -X utf8 scripts/check-approved-baseline.py --strict-evidence
```

승인 manifest와 공식 문서의 바이트 hash를 확인한다. `.gitattributes`는 보호 대상의 checkout 줄끝 변환을 막는다. 추가 계약 정적 검사는 기존 검사기를 임시 복사본에서 실행하고 `.artifacts/`에 결과를 남겨 승인 당시 보고서를 보존한다.

구현자가 공유 계약·승인 기록을 임의 수정하지 않는다. 변경은 [ADR-005](docs/decisions/adr/ADR-005-CONTRACT-BASELINE.md)에 따라 영향·예제·호환성·사용자 승인을 기록한다. 로컬/CI 검사는 저장소의 보호 브랜치·필수 리뷰 설정을 대신하지 않는다. GitHub Actions 구성의 원격 실행과 브랜치 보호 적용 여부는 검증 결과에서 따로 기록한다.
