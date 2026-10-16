# 로컬 개발 서비스

승인 구조를 구현할 개발용 PostgreSQL·메일 수신기를 준비한다. 백엔드 `local-infra` 기동 시 Flyway가 `auction.rounds`를 생성하며, 아래 명시적 seed를 실행해야 예제 회차가 생긴다. 회원·운영자·자동 진행은 생성하지 않는다. 실제 운영 배포 설정은 아니다.

Docker Desktop을 실행하고, 저장소 루트에서 다음 명령으로 백엔드와 인프라를 함께 시작한다. `JAVA_HOME`은 Amazon Corretto 25를 가리켜야 한다.

```powershell
.\backend\gradlew.bat -p backend --no-daemon bootRunLocal
```

현재 소스 컴파일과 `infra/up.ps1` 실행 후 실제 Compose 포트·비밀번호를 백엔드에 전달한다. JAR을 미리 빌드했다면 `scripts/run-backend.ps1 -WithInfrastructure`도 같은 자동 준비를 수행한다. IntelliJ의 공유 `Backend (local Docker)` 구성도 `bootRunLocal`을 사용한다. 자세한 설정과 실제 검증 범위는 [백엔드 안내](../backend/README.md#docker와-함께-로컬-실행), [로컬 Docker 연동 검증](../docs/implementation/LOCAL-BACKEND-COMPOSE-VERIFICATION.md)을 따른다.

인프라만 따로 기동하거나 앱 종료 후 서비스를 중지할 때는 다음 명령을 사용한다.

```powershell
pwsh -NoProfile -File infra/up.ps1
pwsh -NoProfile -File infra/stop.ps1
```

두 스크립트는 저장소 루트에서 실행할 수 있다. PowerShell 7·Docker Compose가 필요하다. `up.ps1`은 전용 프로젝트 `auction-platform-dev`만 생성/기동하고 준비를 기다린다. 앱 종료만으로 서비스가 중지되지는 않는다. `stop.ps1`은 그 서비스만 중지하며 볼륨·비밀번호·다른 프로젝트는 삭제하지 않는다. 포트가 이미 사용 중이면 소유 프로세스를 확인하고 이 프로젝트의 포트를 변경한다.

| 서비스 | 기본 주소 | 용도 |
| --- | --- | --- |
| PostgreSQL | `127.0.0.1:55432`, DB/사용자 `auction` | JDBC 어댑터 준비. 개발용 초기 사용자이며 제품 권한 모델 아님 |
| Mailpit SMTP | `127.0.0.1:51025` | 로컬 테스트 메일 수신 |
| Mailpit UI | `http://127.0.0.1:58025` | 로컬에 수신한 테스트 메일 확인 |
| 사진 디렉터리 | `infra/.runtime/photos` | 후속 사진 저장 어댑터를 위한 경로 준비. 현재 업로드/정리 기능 없음 |

포트 재정의는 `infra/.env.example`을 `infra/.env`로 복사하거나 동일 환경변수를 설정한다. `up.ps1`은 Compose의 실제 DB·SMTP 포트를 조회해 비밀 없는 `.runtime/backend.properties`에 기록하고 두 백엔드 실행기가 이를 사용한다. 따라서 포트를 바꿀 때 별도의 `DB_URL`·`MAIL_PORT`를 맞출 필요가 없다. 모든 호스트 포트는 loopback에만 바인딩한다. 메일 외부 relay/forwarding은 구성하지 않는다. 이 포트·readiness 재시도는 개발 도구 설정이며 승인된 경매 시간·장애 감지 상한이 아니다.

DB 이름과 사용자는 `auction`이다. 비밀번호를 직접 정하거나 입력할 필요는 없다. `prepare.ps1`은 첫 실행 때 난수 비밀번호를 Git에서 제외한 `.runtime/db-password`에 만들고 기존 파일은 재사용한다. 비밀번호를 화면·Git·예제에 넣지 않는다. Compose secret으로 DB에 전달하며 값을 읽어 출력하는 `docker compose config` 대신 `config --quiet`로 검증한다. 기존 DB 볼륨의 비밀번호를 파일 교체만으로 변경할 수 없으므로 이 파일을 임의 재생성하지 않는다.

백엔드 `local-infra` 프로필의 변수는 `DB_URL`, `DB_USER`, `DB_PASSWORD`, `MAIL_HOST`, `MAIL_PORT`, `PHOTO_ROOT`다. `bootRunLocal`은 앱 자식 프로세스에 이 환경을 주입하고, JAR 실행기는 실행 후 기존 PowerShell 프로세스 환경을 복원한다. 두 실행기는 전용 개발 Compose의 값으로 연결하므로 기존 `DB_URL`·`DB_USER`·`DB_PASSWORD` 값에 의존하지 않는다. 기본 backend 프로필은 외부 DB 연결이 없는 골격이다. 구체 명령은 [백엔드 안내](../backend/README.md)를 따른다.

이미지 버전과 digest의 원본은 [compose.yaml](compose.yaml)이다. PostgreSQL 18의 데이터 볼륨은 `/var/lib/postgresql`에 마운트한다. 비밀번호 파일과 초기화 변수의 동작도 공식 이미지 안내를 따른다. [PostgreSQL 공식 이미지](https://github.com/docker-library/docs/blob/master/postgres/README.md#pgdata), [Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/)

Mailpit은 제품 메일 전송과 분리된 개발 수신기로 선택했다. UI·SMTP 연결을 재현하기 위한 구성으로, 이메일 검증·재설정 기능이 구현됐다는 증거는 아니다. [Mailpit Docker 안내](https://mailpit.axllent.org/docs/install/docker/)

## 공개 회차 개발 데이터

`bootRunLocal` 또는 `scripts/run-backend.ps1 -JavaHome <Corretto25> -WithInfrastructure`로 백엔드를 기동한 뒤 별도 터미널에서 아래 seed를 실행한다. 백엔드 최초 기동은 빈 업무 테이블과 Flyway 이력만 만든다.

```powershell
pwsh -NoProfile -File infra/seed-demo.ps1
```

[fixtures/public-rounds.sql](fixtures/public-rounds.sql)은 전용 개발 Compose의 DB에만 실행한다. `demo-round`는 공개된 합성 회차, `demo-hidden`은 미공개 회차다. 재실행은 기존 행을 덮어쓰지 않는다. 운영 데이터·회원·비밀번호를 포함하지 않으며 애플리케이션 리소스나 마이그레이션에 포함하지 않는다.

`scripts/verify.ps1 -Integration`은 별도의 임시 PostgreSQL 컨테이너·난수 포트·메모리 비밀번호를 사용한다. 개발 DB/볼륨을 이용하지 않으며 실행 후 자신이 만든 프로세스·컨테이너·임시 DB 볼륨을 정리한다. 결과와 로그는 `.artifacts/integration`, 브라우저 결과는 `output/playwright`에 남긴다. Docker 미기동은 검사 실패다.
