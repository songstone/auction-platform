# 개발용 데이터

백엔드 실행에 필요한 PostgreSQL·Mailpit 설정은 [backend/compose.yaml](../backend/compose.yaml)에 있다. 시작·중지는 [백엔드 안내](../backend/README.md)를 따른다. 이 디렉터리는 명시적으로 넣는 개발용 fixture를 보관한다.

백엔드를 `local-infra` 프로필로 시작하여 Flyway 마이그레이션이 끝난 뒤, 저장소 루트에서 실행한다.

```powershell
pwsh -NoProfile -File infra/seed-demo.ps1
```

[seed-demo.ps1](seed-demo.ps1)은 전용 개발 Compose 프로젝트 `auction-platform-dev`의 PostgreSQL에만 [fixtures/public-rounds.sql](fixtures/public-rounds.sql)을 적용한다. `demo-round`는 공개된 합성 회차, `demo-hidden`은 미공개 회차다. 재실행해도 기존 행을 덮어쓰지 않는다. 회원·비밀번호를 만들지 않으며 fixture는 애플리케이션 리소스나 마이그레이션에 포함하지 않는다.

`scripts/verify.ps1 -Integration`은 별도 임시 PostgreSQL을 사용하며 개발 DB·볼륨을 이용하지 않는다. Docker가 없으면 검사에 실패한다. 실행 결과는 `.artifacts/integration`, 브라우저 결과는 `output/playwright`에 남긴다.
