# SPIKE-001 실험 재현

제품 코드가 아닌 격리된 실험이다. 승인 계획과 결과 해석은 [SPIKE-001](../../docs/spikes/SPIKE-001.md)에 기록한다. Java **25**로 컴파일하고 실행한다.

## 환경과 기동

Windows PowerShell, Docker Desktop의 Linux 엔진, Python 3, Node.js/npm, JDK 25가 필요하다. 이 실행에서는 Corretto 25.0.3, Spring Boot 3.5.16, Maven Wrapper 3.9.16, PostgreSQL 18.6-alpine을 사용했다. JDK 경로는 스크립트의 `-JavaHome`으로 바꿀 수 있다.

```powershell
Set-Location experiments/spike-001
.\prepare.ps1
.\build.ps1
.\start.ps1 -Port 18081
.\start.ps1 -Port 18082
.\environment.ps1
```

DB는 전용 `auction-spike-001-db` 컨테이너, loopback 15432 포트, CPU 2개·메모리 1GiB다. 생성한 비밀번호는 Git 제외 경로 `.runtime/db.json`에 두며 응답·증거에 출력하지 않는다. 앱은 loopback 18081/18082, JVM당 최대 heap 512MiB, DB pool 최대 16이다. 관리·장애 주입 API는 이 실험에만 있고 제품 인증/권한을 대신하지 않는다.

앱은 수동 시험 모드로 시작한다. 실제 시간 자동 진행은 fixture reset의 `manual:false` 또는 `/admin/mode`의 `manual:false,realClock:true`로 켠다. 프로세스 장애 복구 재현에는 `start.ps1 -Recover`를 사용한다. 이 옵션은 미완료 레인을 보류하고 운영 확인을 요구한다. PostgreSQL postmaster 재시작은 저장된 epoch가 바뀌면 상태 변경 전에 감지한다. 임의 네트워크 분할과 전체 장애 감지를 완성한 운영 구조는 아니다.

## 정확성·장애 실행

아래 명령은 DB 상태를 초기화하므로 한 번에 하나의 suite만 실행한다. 실제 실행의 명령·종료 코드·원시 자료는 `results/`의 RunId 아래에 남긴다.

```powershell
python harness/correctness.py --repeats 100 --failure-repeats 10
python harness/regressions.py --repeats 10
python harness/crashes.py --repeats 10
python harness/environment_failures.py --db-repeats 10 --timing-repeats 10
python harness/stream_crashes.py --repeats 10
```

정확한 script 옵션은 각 `--help`와 실제 실행 기록을 함께 따른다. Python suite는 HTTP로 독립 호출하고 DB audit 응답을 규칙에 따라 검증한다. Maven `package`는 빌드 확인이며 위 테스트 실행을 대신하지 않는다. fixture 시각 경계 시험은 실제 지연 성능 수치와 구분한다.

`environment_failures.py`는 전용 컨테이너의 `purpose=auction-spike-001` 라벨을 확인한 뒤 실제 PostgreSQL 프로세스를 강제 종료·재시작한다. 또한 재개 트랜잭션의 기록 시각과 실제 commit timestamp 사이의 간격을 측정한다. 후자는 물리 commit 기준 전체 시간 보장에 관한 미해결 위험을 드러내는 시험이다.

`stream_crashes.py`는 commit 이후 전송 전, 실제 SSE 프레임 수신 이후 발행 표시 전의 두 지점에서 전용 JVM을 종료한다. 프로세스·PID 파일을 확인하고 종료/재기동·원결과·다른 노드 재전파를 기록한다. SSE 프레임 수신은 브라우저 DOM 측정과 구분한다.

## 실시간·브라우저·부하 실행

```powershell
Set-Location realtime
npm ci
node model-test.mjs
node corruption.mjs --core-passed
node reconnect.mjs --core-passed
node browser-run.mjs --core-passed
node load.mjs --scenario base --connections 100 --core-passed
node load.mjs --scenario concentrated --connections 100 --core-passed
```

`--core-passed`는 앞선 정확성·복구 검증 근거가 있을 때만 사용한다. 기본 부하는 60초 warm-up + 300초 측정 × 3회다. 100 프로토콜 연결의 응답 시간과 실제 Chrome DOM 반영 표본은 서로 다른 측정이다. 브라우저와 추가 왕복 100ms proxy의 세부 재현은 [realtime/README.md](realtime/README.md)를 따른다.

SSE는 상태를 포함하는 이벤트와 레인별 버전을 전달한다. 클라이언트는 구독·버퍼 준비 뒤 snapshot을 병합하고, 오래된 버전은 무시하며, 버전 공백/heartbeat 불일치는 재조회한다. SSE 연결 자체를 원입찰 결과 확인으로 사용하지 않는다. 실제 원결과를 표시한 후 해당 요청번호를 확인한다.

## 자료와 한계

`results/environment.json`은 실행 버전·자원·소스 hash를 담는다. `results/correctness`, `results/regressions`, `results/crashes`, `results/environment-failures`, `results/realtime`은 실제 실행 자료다. 실패한 초기 실행도 삭제하지 않으며 최종 결과 문서에서 수정 후 실행과 구분한다.

이 실험은 인증·제품 UI·모집/배정 전체 흐름·DB failover·전원/디스크 손실·운영 배포를 검증하지 않는다. 행 락, 접수 기록, outbox, 클라이언트 동기화 규약의 증거를 얻기 위한 코드다. `historyComplete=false`에서 확인 가능한 이력으로 다시 전환하는 관리 기능과 실제 전이 기록 시각/물리 commit 간 계약은 후속 설계가 필요하다.

빌드 전 실행 중인 전용 JVM은 `./stop.ps1`로 중지한다. 전체 실험 종료 뒤 `./stop.ps1 -Database`는 해당 JAR 프로세스와 라벨을 확인한 전용 DB만 중지하며 데이터를 삭제하지 않는다. Docker Desktop 자체는 종료하지 않는다.

읽기 전용 자원 표본은 실험 폴더에서 `python harness/resource_monitor.py --interval 15`로 수집한다. `.runtime/stop-monitor` 파일을 만들면 다음 반복 전에 종료한다. 다시 측정할 때는 이 종료 신호 파일만 제거한다. 두 앱 HTTP metrics·DB 집계·Docker stats의 추가 부하가 포함되며, 관측 최대값은 연속 측정 최대값이 아니다.
