# Spring Boot 기본 Docker Compose 연결 검증 — 2026-10-16

사용자 요청으로 직전 `c0b5adf`, `94b5c43`을 각각 `2fcbf47`, `dd6e8ed`에서 revert했다. 새 구현 커밋은 `f6c96d205e74b458494ffc418d200cea6f87fcff`다. 이 보고서는 그 뒤의 문서 커밋이며 기존 승인 기준선은 변경하지 않았다.

`backend/compose.yaml`과 개발 전용 `spring-boot-docker-compose` 의존성으로 표준 `bootRun`/Application 실행을 사용한다. 기존 커스텀 Gradle 작업·실행 구성·인프라 준비/기동 스크립트는 제거했다. `local-infra` 프로필, working directory `backend`, ignored `backend/.env`를 사용한다. 기존 비밀번호·Compose 프로젝트·DB 볼륨은 보존했다. Flyway 이력 위치는 재시작 시에도 `public`으로 고정한다.

## 검증

환경: Windows, Corretto 25.0.3, Boot 4.1.1, Gradle Wrapper 9.8.1, Docker Engine 28.5.1. 실행 로그는 `.artifacts/native-compose/`에 있다.

```powershell
python scripts/check-approved-baseline.py --strict-evidence
pwsh -NoProfile -File scripts/verify.ps1 -JavaHome C:/Users/jitin81/.jdks/corretto-25.0.3 -Integration
.venv/Scripts/python.exe scripts/verify-integration.py --java-home C:/Users/jitin81/.jdks/corretto-25.0.3 --skip-build
python .artifacts/native-compose/smoke.py
```

| 범위 | 결과 / 증거 |
| --- | --- |
| 계약·BE·FE | strict 20파일, 계약 검사, BE 단위/아키텍처 13개·실제 PostgreSQL 15개, FE test/build PASS. `verification.log`, `test-summary.json` |
| 표준 `bootRun` | 중지된 Compose 자동 기동 → DB 목록 200. 다른 호스트 포트도 자동 연결. `native-cold-start.log` |
| 재실행 | 이미 실행 중인 서비스 재사용, DB 접속 환경변수 없이 연결, 잘못된 `DB_*`보다 서비스 연결 우선. `native-reuse-running.log` |
| 보존·패키징 | DB 행·이력·기존 비밀번호 보존, 로그 비밀번호 검출 0, 기본 포트 복원, bootJar에서 Compose 모듈 제외. `runtime-summary.json` |
| 실제 DB/HTTP·브라우저·DB 장애 복구 | clean `f6c96d2`에서 PASS. `.artifacts/integration/20261016T163432-16f38222/summary.json`, `integration-final.log` |

표준 기동 smoke와 BE/FE 빌드는 커밋 직전 동일 구현을 실행했고, smoke의 `codeBase`는 작업 시작 시점의 revert 커밋이다. 이후 소스 변경 없이 `f6c96d2`로 커밋한 뒤 portable 통합 검사를 실행했다. portable 검사는 임시 DB를 사용하고 종료 시 자체 프로세스·컨테이너를 정리했다. 개발 DB smoke는 조회만 수행했고 기존 볼륨을 삭제하지 않았다.

첫 빌드는 `developmentOnly`에 BOM이 없어 버전 해석에 실패하여 해당 구성에도 Boot BOM을 적용했다. 이후 wrapper의 BE/FE/DB 검사는 통과했으나 portable 단계는 dirty checkout guard로 실행 전 중단됐다. 후보 커밋을 만든 후 portable 명령을 별도로 실행하여 PASS를 확인했다. 실패 로그도 보존했다.

## 인계

최종 문서 포함 커밋의 CI 확인 후 `dev`로 통합한다. 정확한 최종 SHA·CI·브랜치 정리는 `.artifacts/native-compose/final-handoff.json`과 사용자 인계에 기록한다. IntelliJ 화면/디버거, 실제 메일·사진, 인증 세션·입찰·SSE·운영 준비는 NOT_RUN이다. Mailpit 기동은 메일 adapter 구현 증거가 아니다.

설정 근거: [Spring Boot 개발용 Compose 공식 문서](https://docs.spring.io/spring-boot/reference/features/dev-services.html). 실행 방법은 [backend/README](../../backend/README.md)를 따른다.
