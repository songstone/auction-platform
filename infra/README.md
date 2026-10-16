# 로컬 개발 서비스

승인 구조를 구현할 개발용 PostgreSQL·메일 수신기만 준비한다. 경매 테이블·회원·운영자·업무 API·자동 진행은 생성하지 않는다. 실제 운영 배포 설정은 아니다.

```powershell
pwsh -NoProfile -File infra/up.ps1
pwsh -NoProfile -File infra/stop.ps1
```

두 스크립트는 저장소 루트에서 실행할 수 있다. PowerShell 7·Docker Compose가 필요하다. `up.ps1`은 전용 프로젝트 `auction-platform-dev`만 생성/기동하며 `stop.ps1`은 그 서비스만 중지한다. 볼륨·비밀번호·다른 프로젝트는 삭제하지 않는다. 포트가 이미 사용 중이면 소유 프로세스를 확인하고 이 프로젝트의 포트를 변경한다.

| 서비스 | 기본 주소 | 용도 |
| --- | --- | --- |
| PostgreSQL | `127.0.0.1:55432`, DB/사용자 `auction` | JDBC 어댑터 준비. 개발용 초기 사용자이며 제품 권한 모델 아님 |
| Mailpit SMTP | `127.0.0.1:51025` | 로컬 테스트 메일 수신 |
| Mailpit UI | `http://127.0.0.1:58025` | 로컬에 수신한 테스트 메일 확인 |
| 사진 디렉터리 | `infra/.runtime/photos` | 후속 사진 저장 어댑터를 위한 경로 준비. 현재 업로드/정리 기능 없음 |

포트 재정의는 `.env.example`을 `.env`로 복사하거나 동일 환경변수를 설정한다. 모든 호스트 포트는 loopback에만 바인딩한다. 메일 외부 relay/forwarding은 구성하지 않는다. 이 포트·readiness 재시도는 개발 도구 설정이며 승인된 경매 시간·장애 감지 상한이 아니다.

`prepare.ps1`은 첫 실행 때 난수 비밀번호를 무시되는 `.runtime/db-password`에 만들고 기존 파일은 재사용한다. 비밀번호를 화면·Git·예제에 넣지 않는다. Compose secret으로 DB에 전달하며 값을 읽어 출력하는 `docker compose config` 대신 `config --quiet`로 검증한다. 기존 DB 볼륨의 비밀번호를 파일 교체만으로 변경할 수 없으므로 이 파일을 임의 재생성하지 않는다.

백엔드 `local-infra` 프로필의 변수는 `DB_URL`, `DB_USER`, `DB_PASSWORD`, `MAIL_HOST`, `MAIL_PORT`, `PHOTO_ROOT`다. 비밀번호는 현재 PowerShell 프로세스에만 전달하고 실행 뒤 제거한다. 기본 backend 프로필은 외부 DB 연결이 없는 골격이다. 구체 명령은 [백엔드 안내](../backend/README.md)를 따른다.

이미지 버전과 digest의 원본은 [compose.yaml](compose.yaml)이다. PostgreSQL 18의 데이터 볼륨은 `/var/lib/postgresql`에 마운트한다. 비밀번호 파일과 초기화 변수의 동작도 공식 이미지 안내를 따른다. [PostgreSQL 공식 이미지](https://github.com/docker-library/docs/blob/master/postgres/README.md#pgdata), [Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/)

Mailpit은 제품 메일 전송과 분리된 개발 수신기로 선택했다. UI·SMTP 연결을 재현하기 위한 구성으로, 이메일 검증·재설정 기능이 구현됐다는 증거는 아니다. [Mailpit Docker 안내](https://mailpit.axllent.org/docs/install/docker/)
